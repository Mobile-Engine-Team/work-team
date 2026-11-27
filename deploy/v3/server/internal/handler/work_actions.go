package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/service"
	"github.com/multica-ai/multica/server/internal/workbench"
)

func workAction(prompt string) (string, string) {
	switch {
	case strings.Contains(prompt, "邀请成员"):
		return "invite", "邀请成员入口"
	case strings.Contains(prompt, "我的文件"):
		return "files", "我的文件入口"
	case strings.Contains(prompt, "创建项目") || strings.Contains(prompt, "新建项目"):
		return "project", "新建项目入口"
	case strings.Contains(prompt, "创建任务") || strings.Contains(prompt, "建一个任务") || strings.Contains(prompt, "新建任务"):
		return "task", "确认任务草案"
	}
	return "", ""
}
func workActionResult(c workbench.Corpus, prompt string) workbench.Result {
	action, title := workAction(prompt)
	v := workbench.View{SchemaVersion: 1, Title: title, Intent: prompt, Queries: []workbench.Query{{Source: "project"}}, Blocks: []workbench.Block{{Type: "text", Title: title, Text: "打开入口后可以继续操作。", Items: []workbench.Item{}, EvidenceIDs: []string{}}}, Limitations: []string{}}
	return workbench.Result{Action: action, Model: "MobileWork", Runtime: "MobileWork", View: v, GeneratedAt: c.At, Fingerprint: c.ViewFingerprint(v), Evidence: []workbench.Evidence{}}
}

func (h *Handler) ConfirmWorkTask(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	msg, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "message")
	if !ok {
		return
	}
	var req struct{ Title, Description string }
	if !decodePlan(w, r, &req) {
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" || len([]rune(req.Title)) > 200 || len(req.Description) > 64000 {
		writeError(w, 422, "请填写有效的任务标题与描述")
		return
	}
	ctx := r.Context()
	tx, err := h.TxStarter.Begin(ctx)
	if err != nil {
		roomError(w, err)
		return
	}
	defer tx.Rollback(ctx)
	var original string
	err = tx.QueryRow(ctx, `SELECT prompt FROM workbench_message WHERE id=$1 AND workspace_id=$2 AND owner_id=$3 AND status='completed' AND result->>'action'='task' FOR UPDATE`, msg, m.WorkspaceID, m.UserID).Scan(&original)
	if err != nil {
		roomError(w, err)
		return
	}
	var issue string
	err = tx.QueryRow(ctx, "SELECT issue_id FROM work_message_task WHERE message_id=$1", msg).Scan(&issue)
	if errors.Is(err, pgx.ErrNoRows) {
		task, e := h.IssueService.CreateInTransaction(ctx, tx, service.IssueCreateParams{WorkspaceID: m.WorkspaceID, Title: req.Title, Description: pgtype.Text{String: req.Description, Valid: true}, CreatorType: "member", CreatorID: m.UserID, Priority: "none", Status: "backlog", AllowDuplicate: true})
		if e != nil {
			roomError(w, e)
			return
		}
		issue = uuidToString(task.Issue.ID)
		_, err = tx.Exec(ctx, "INSERT INTO work_message_task VALUES($1,$2)", msg, issue)
	}
	if err == nil {
		err = tx.Commit(ctx)
	}
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, map[string]string{"id": issue})
}
