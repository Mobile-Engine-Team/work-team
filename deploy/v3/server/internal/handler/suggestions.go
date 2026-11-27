package handler

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// The same predicate gates both presentation and opening the suggested query.
const suggestionCandidate = ` FROM issue i JOIN project p ON p.id=i.project_id AND p.workspace_id=i.workspace_id
WHERE i.workspace_id=$1 AND i.status NOT IN ('done','cancelled') AND (i.assignee_id IS NULL OR i.status='blocked') `

func (h *Handler) WorkSuggestion(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	var req struct{ Action, ID string }
	if !decodePlan(w, r, &req) {
		return
	}
	ctx := r.Context()
	tx, err := h.TxStarter.Begin(ctx)
	if err != nil {
		roomError(w, err)
		return
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "SELECT id FROM member WHERE id=$1 FOR UPDATE", m.ID); err != nil {
		roomError(w, err)
		return
	}
	var issue, conv, key pgtype.UUID
	var title, project, status string
	reply := map[string]any{}
	switch req.Action {
	case "check":
		err = tx.QueryRow(ctx, `SELECT i.id,i.title,p.title,i.status`+suggestionCandidate+`
 AND NOT EXISTS(SELECT 1 FROM work_suggestion s WHERE s.member_id=$2 AND (s.shown_at>now()-interval '3 minutes' OR s.quiet_until>now() OR (s.issue_id=i.id AND s.shown_at>now()-interval '24 hours')))
 ORDER BY (i.status='blocked') DESC,i.updated_at DESC,i.id LIMIT 1`, m.WorkspaceID, m.ID).Scan(&issue, &title, &project, &status)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, 200, reply)
			return
		}
		if err == nil {
			_, err = tx.Exec(ctx, `INSERT INTO work_suggestion(workspace_id,member_id,issue_id) VALUES($1,$2,$3)
			ON CONFLICT(member_id,issue_id) DO UPDATE SET shown_at=now(),conversation_id=NULL,request_id=NULL`, m.WorkspaceID, m.ID, issue)
		}
		reason := "任务尚未分配负责人"
		if status == "blocked" {
			reason = "任务状态为阻塞"
		}
		reply = map[string]any{"id": uuidToString(issue), "title": title, "project": project, "reason": reason}
	case "snooze", "open":
		issue, ok = parseUUIDOrBadRequest(w, req.ID, "issue")
		if !ok {
			return
		}
		err = tx.QueryRow(ctx, `SELECT conversation_id,request_id FROM work_suggestion WHERE workspace_id=$1 AND member_id=$2 AND issue_id=$3`, m.WorkspaceID, m.ID, issue).Scan(&conv, &key)
		if err != nil {
			roomError(w, err)
			return
		}
		if req.Action == "snooze" {
			_, err = tx.Exec(ctx, "UPDATE work_suggestion SET quiet_until=now()+interval '1 hour' WHERE member_id=$1 AND issue_id=$2", m.ID, issue)
			break
		}
		err = tx.QueryRow(ctx, `SELECT i.title,p.title`+suggestionCandidate+" AND i.id=$2 FOR SHARE OF i,p", m.WorkspaceID, issue).Scan(&title, &project)
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, 409, "任务情况已变化，请重新查看")
			return
		}
		prompt := "查看「" + project + "」中「" + title + "」的当前进展与下一步。"
		if err == nil && !conv.Valid {
			err = tx.QueryRow(ctx, "INSERT INTO workbench_conversation(workspace_id,owner_id,title) VALUES($1,$2,$3) RETURNING id,gen_random_uuid()", m.WorkspaceID, m.UserID, title).Scan(&conv, &key)
			if err == nil {
				_, err = tx.Exec(ctx, "UPDATE work_suggestion SET conversation_id=$3,request_id=$4 WHERE member_id=$1 AND issue_id=$2", m.ID, issue, conv, key)
			}
		}
		reply = map[string]any{"conversationId": uuidToString(conv), "requestId": uuidToString(key), "prompt": prompt}
	default:
		writeError(w, 422, "无效操作")
		return
	}
	if err == nil {
		err = tx.Commit(ctx)
	}
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, reply)
}
