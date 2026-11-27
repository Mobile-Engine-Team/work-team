package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/service"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type issueRunReceipt struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	TaskID string `json:"task_id,omitempty"`
	Reason string `json:"reason,omitempty"`
}

func (h *Handler) requestIssueRun(w http.ResponseWriter, r *http.Request, member db.Member, issue db.Issue, keyString, sourceString string) {
	key, ok := parseUUIDOrBadRequest(w, keyString, "id")
	if !ok {
		return
	}
	var source pgtype.UUID
	if sourceString != "" {
		source, ok = parseUUIDOrBadRequest(w, sourceString, "source_task_id")
		if !ok {
			return
		}
	}
	ctx := r.Context()
	tx, err := h.TxStarter.Begin(ctx)
	if err != nil {
		roomError(w, err)
		return
	}
	defer tx.Rollback(ctx)
	// A lost HTTP response is safe to replay, including after the execution
	// finished. Independent members own independent request keys.
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", uuidToString(member.ID)+":"+uuidToString(key)); err != nil {
		roomError(w, err)
		return
	}
	var same bool
	var stored json.RawMessage
	err = tx.QueryRow(ctx, "SELECT issue_id=$3 AND source_task_id IS NOT DISTINCT FROM $4::uuid,receipt FROM issue_run_request WHERE member_id=$1 AND request_id=$2", member.ID, key, issue.ID, source).Scan(&same, &stored)
	if err == nil {
		if !same {
			writeError(w, 409, "请求编号已用于另一项操作")
			return
		}
		writeJSON(w, 200, stored)
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		roomError(w, err)
		return
	}
	if source.Valid {
		prior, e := h.Queries.WithTx(tx).GetAgentTaskInWorkspace(ctx, db.GetAgentTaskInWorkspaceParams{ID: source, WorkspaceID: member.WorkspaceID})
		if e != nil || prior.IssueID != issue.ID {
			writeError(w, 404, "运行记录不可用")
			return
		}
	}
	uid, workspace := uuidToString(member.UserID), uuidToString(member.WorkspaceID)
	allowed := func(agent db.Agent) bool { return h.canInvokeAgent(ctx, agent, "member", uid, uid, workspace) }
	receipt := issueRunReceipt{ID: uuidToString(key)}
	dispatch, err := tx.Begin(ctx)
	if err != nil {
		roomError(w, err)
		return
	}
	task, runErr := h.TaskService.RerunInTransaction(ctx, dispatch, issue.ID, source, member.UserID, allowed)
	if runErr != nil {
		if err = dispatch.Rollback(ctx); err != nil {
			roomError(w, err)
			return
		}
		if errors.Is(runErr, service.ErrRerunInvokeNotAllowed) {
			writeError(w, 403, "无权调用该智能体")
			return
		}
		receipt.Status = "failed"
		receipt.Reason = "未能加入执行队列，请检查任务状态、负责人和运行环境"
	} else {
		if err = dispatch.Commit(ctx); err != nil {
			roomError(w, err)
			return
		}
		receipt.Status = "queued"
		receipt.TaskID = uuidToString(task.ID)
	}
	if _, err = tx.Exec(ctx, "INSERT INTO issue_run_request(member_id,request_id,issue_id,source_task_id,receipt) VALUES($1,$2,$3,$4,$5)", member.ID, key, issue.ID, source, benchJSON(receipt)); err != nil {
		roomError(w, err)
		return
	}
	if err = tx.Commit(ctx); err != nil {
		roomError(w, err)
		return
	}
	if task != nil {
		h.TaskService.ProjectTaskCommitted(ctx, *task)
	}
	writeJSON(w, 200, receipt)
}
