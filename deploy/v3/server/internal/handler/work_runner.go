package handler

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"time"
)

// Built-in Work consumes only its own workspace-bound issue and chat jobs.
func (h *Handler) RunBuiltinTasks(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		_, _ = h.DB.Exec(ctx, `UPDATE agent_task_queue q SET status='failed',error='运行超时或服务重启，请在任务页重试',completed_at=now()
            FROM workspace_work w WHERE q.agent_id=w.id AND q.status='running' AND q.started_at<now()-interval '3 minutes'`)
		var task, ws, uid, kind, source, prompt string
		err := h.DB.QueryRow(ctx, `WITH next AS(SELECT q.id,w.workspace_id,coalesce(q.originator_user_id,q.initiator_user_id,i.creator_id,c.creator_id) AS actor,
        CASE WHEN q.chat_session_id IS NULL THEN 'issue' ELSE 'chat' END AS kind,coalesce(q.chat_session_id,q.issue_id) AS source,
        CASE WHEN q.chat_session_id IS NULL THEN concat_ws(E'\n',i.title,i.description,q.handoff_note) ELSE (SELECT cm.content FROM chat_message cm WHERE cm.task_id=q.id AND cm.role='user' LIMIT 1) END AS prompt
        FROM agent_task_queue q JOIN workspace_work w ON w.id=q.agent_id AND w.id=q.runtime_id
        LEFT JOIN issue i ON i.id=q.issue_id AND i.workspace_id=w.workspace_id
        LEFT JOIN chat_session c ON c.id=q.chat_session_id AND c.workspace_id=w.workspace_id
        WHERE q.status='queued' AND (q.fire_at IS NULL OR q.fire_at<=now()) AND (i.id IS NOT NULL OR c.id IS NOT NULL)
        ORDER BY q.created_at FOR UPDATE OF q SKIP LOCKED LIMIT 1)
        UPDATE agent_task_queue q SET status='running',started_at=now() FROM next WHERE q.id=next.id
        RETURNING q.id,next.workspace_id,coalesce(next.actor::text,''),next.kind,next.source,coalesce(next.prompt,'')`).Scan(&task, &ws, &uid, &kind, &source, &prompt)
		if err != nil {
			continue
		}
		m, err := h.getWorkspaceMember(ctx, uid, ws)
		var answer string
		if err == nil && m.Role != "guest" && prompt != "" {
			run, cancel := context.WithTimeout(ctx, 95*time.Second)
			answer, err = h.workText(run, "你是内置 Work。基于提供的材料完成任务并给出交付结果。", "", prompt)
			cancel()
		} else {
			err = errors.New("成员权限已变更或输入为空")
		}
		h.finishBuiltinTask(ctx, task, ws, uid, kind, source, answer, err)
	}
}
func (h *Handler) finishBuiltinTask(ctx context.Context, task, ws, uid, kind, source, answer string, runErr error) {
	tx, err := h.TxStarter.Begin(ctx)
	if err != nil {
		return
	}
	defer tx.Rollback(ctx)
	var agent string
	err = tx.QueryRow(ctx, `SELECT q.agent_id FROM agent_task_queue q JOIN workspace_work w ON w.id=q.agent_id WHERE q.id=$1 AND q.status='running' AND w.workspace_id=$2 FOR UPDATE OF q`, task, ws).Scan(&agent)
	if err != nil {
		return
	}
	var actor string
	if err = tx.QueryRow(ctx, `SELECT user_id FROM member WHERE workspace_id=$1 AND user_id::text=$2 AND role<>'guest' FOR SHARE`, ws, uid).Scan(&actor); err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return
		}
		runErr = errors.New("成员权限已失效")
	}
	if runErr == nil {
		if kind == "issue" {
			_, err = tx.Exec(ctx, `INSERT INTO comment(issue_id,workspace_id,author_type,author_id,content) SELECT id,workspace_id,'agent',$3,$4 FROM issue WHERE id=$1 AND workspace_id=$2`, source, ws, agent, answer)
		} else {
			_, err = tx.Exec(ctx, `INSERT INTO chat_message(chat_session_id,role,content,task_id) SELECT id,'assistant',$3,$4 FROM chat_session WHERE id=$1 AND workspace_id=$2 AND creator_id=$5`, source, ws, answer, task, uid)
		}
		if err != nil {
			return
		}
		_, err = tx.Exec(ctx, `UPDATE agent_task_queue SET status='completed',completed_at=now(),result=jsonb_build_object('summary',$2::text,'mock',$3::boolean) WHERE id=$1`, task, answer, mockWork())
	} else {
		_, err = tx.Exec(ctx, `UPDATE agent_task_queue SET status='failed',completed_at=now(),error=$2 WHERE id=$1`, task, runErr.Error())
	}
	if err == nil {
		_ = tx.Commit(ctx)
	}
}
