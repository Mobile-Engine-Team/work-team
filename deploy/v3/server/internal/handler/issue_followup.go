package handler

import (
	"context"
	"encoding/json"
	"github.com/go-chi/chi/v5"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func (h *Handler) IssueFollowup(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	i, ok := h.loadIssueForUser(w, r, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	ctx := r.Context()
	var raw json.RawMessage
	err := error(nil)
	if r.Method == "GET" {
		err = h.DB.QueryRow(ctx, `SELECT jsonb_build_object('links',(SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY url),'[]') FROM issue_reference_url l WHERE l.issue_id=$1),
		'requests',(SELECT coalesce(jsonb_agg(receipt || jsonb_build_object('created_at',created_at)
            ORDER BY created_at DESC,request_id DESC),'[]') FROM issue_run_request WHERE issue_id=$1 AND member_id=$2),
        'reminders',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY scheduled_at),'[]') FROM issue_member_reminder t WHERE t.issue_id=$1 AND t.member_id=$2))`, i.ID, m.ID).Scan(&raw)
		if err != nil {
			roomError(w, err)
			return
		}
		writeJSON(w, 200, raw)
		return
	}
	var req struct {
		Action, ID, URL, Instruction string
		Title                        *string
		SourceTaskID                 string `json:"source_task_id"`
		At                           time.Time
	}
	if !decodePlan(w, r, &req) {
		return
	}
	var changed string
	switch req.Action {
	case "run":
		h.requestIssueRun(w, r, m, i, req.ID, req.SourceTaskID)
		return
	case "link":
		u, e := url.Parse(strings.TrimSpace(req.URL))
		if e != nil || u.Hostname() == "" || (u.Scheme != "https" && u.Scheme != "http") || len(req.URL) > 4000 || u.User != nil {
			writeError(w, 422, "请输入有效的 HTTP 或 HTTPS 链接")
			return
		}
		if req.Title != nil {
			title := strings.TrimSpace(*req.Title)
			req.Title = &title
		}
		err = h.DB.QueryRow(ctx, `INSERT INTO issue_reference_url(issue_id,url,creator_id,title)
            VALUES($1,$2,$3,coalesce($4::text,''))
            ON CONFLICT(issue_id,url) DO UPDATE SET title=coalesce($4,issue_reference_url.title) RETURNING id`,
			i.ID, u.String(), m.UserID, req.Title).Scan(&changed)
	case "unlink", "pause", "resume", "delete", "schedule":
		id, ok := parseUUIDOrBadRequest(w, req.ID, "id")
		if !ok {
			return
		}
		switch req.Action {
		case "unlink":
			err = h.DB.QueryRow(ctx, "DELETE FROM issue_reference_url WHERE issue_id=$1 AND id=$2 RETURNING id", i.ID, id).Scan(&changed)
		case "schedule":
			if !req.At.After(time.Now()) || strings.TrimSpace(req.Instruction) == "" || len(req.Instruction) > 8000 {
				writeError(w, 422, "请选择将来的时间并填写提醒内容")
				return
			}
			err = h.DB.QueryRow(ctx, `INSERT INTO issue_member_reminder(id,issue_id,member_id,scheduled_at,instruction) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET id=excluded.id WHERE issue_member_reminder.issue_id=$2 AND issue_member_reminder.member_id=$3 AND issue_member_reminder.scheduled_at=$4 AND issue_member_reminder.instruction=$5 RETURNING id`, id, i.ID, m.ID, req.At, req.Instruction).Scan(&changed)
		case "delete":
			err = h.DB.QueryRow(ctx, "DELETE FROM issue_member_reminder WHERE issue_id=$1 AND member_id=$2 AND id=$3 RETURNING id", i.ID, m.ID, id).Scan(&changed)
		default:
			state := "paused"
			if req.Action == "resume" {
				state = "scheduled"
			}
			err = h.DB.QueryRow(ctx, "UPDATE issue_member_reminder SET status=$4 WHERE issue_id=$1 AND member_id=$2 AND id=$3 AND status<>'delivered' AND ($4='paused' OR scheduled_at>now()) RETURNING id", i.ID, m.ID, id, state).Scan(&changed)
		}
	default:
		writeError(w, 422, "无效操作")
		return
	}
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, map[string]string{"id": changed})
}
func (h *Handler) RunMemberReminders(ctx context.Context) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// The inbox write and the delivered timestamp commit in one statement.
			_, _ = h.DB.Exec(ctx, `WITH due AS (SELECT id FROM issue_member_reminder WHERE status='scheduled' AND scheduled_at<=now() ORDER BY scheduled_at FOR UPDATE SKIP LOCKED LIMIT 100),
		fired AS (UPDATE issue_member_reminder r SET status='delivered',delivered_at=now() FROM due WHERE r.id=due.id RETURNING r.*)
		INSERT INTO inbox_item(workspace_id,recipient_type,recipient_id,type,severity,issue_id,title,body,actor_type,actor_id,details)
		SELECT i.workspace_id,'member',m.user_id,'issue_assigned','info',i.id,'任务提醒 · '||i.title,f.instruction,'member',m.user_id,jsonb_build_object('reminder_id',f.id) FROM fired f JOIN issue i ON i.id=f.issue_id JOIN member m ON m.id=f.member_id AND m.workspace_id=i.workspace_id`)
		}
	}
}
