package handler

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// Attempt numbers fence late completions if a worker dies and its lease expires.
func (h *Handler) RunRoomWork(ctx context.Context) {
	timer := time.NewTimer(time.Second)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
		}
		var msg, ws, uid, prompt string
		var room pgtype.UUID
		var attempt int
		err := h.DB.QueryRow(ctx, `WITH next AS (
			SELECT message_id FROM collaboration_work WHERE status='queued' OR (status='running' AND updated_at<now()-interval '2 minutes')
			ORDER BY updated_at,message_id FOR UPDATE SKIP LOCKED LIMIT 1
		) UPDATE collaboration_work w SET status='running',attempt=w.attempt+1,updated_at=now()
		FROM next,collaboration_message m,collaboration_room r WHERE w.message_id=next.message_id
		  AND m.id=w.message_id AND r.id=m.room_id RETURNING m.id,r.workspace_id,m.sender_id,m.room_id,m.content,w.attempt`).Scan(&msg, &ws, &uid, &room, &prompt, &attempt)
		if err != nil {
			timer.Reset(1500 * time.Millisecond)
			continue
		}
		run, cancel := context.WithTimeout(ctx, 95*time.Second)
		m, err := h.getWorkspaceMember(run, uid, ws)
		var answer string
		if err == nil && m.Role != "guest" {
			var input string
			input, err = h.scopedWorkInput(run, m, "room", room)
			if err == nil {
				answer, err = h.workText(run, "你是群聊中的 Work，根据本群可见消息回答。", input, prompt)
			}
		} else {
			err = errors.New("发起成员已无权限")
		}
		cancel()
		state, reason := "completed", ""
		if err != nil {
			state, reason, answer = "failed", "未能完成本次请求，请检查运行环境或成员权限后重试。", ""
		}
		_, _ = h.DB.Exec(ctx, `UPDATE collaboration_work w SET status=CASE WHEN permitted.ok THEN $3 ELSE 'failed' END,
		answer=CASE WHEN permitted.ok THEN $4 ELSE '' END,failure=CASE WHEN permitted.ok THEN $5 ELSE '成员权限已失效' END,updated_at=now()
		FROM (SELECT EXISTS(SELECT r.id`+visibleRoom+` AND r.id=$8 AND m.role<>'guest') AS ok) permitted
		WHERE w.message_id=$6 AND w.attempt=$7 AND w.status='running'`, ws, uid, state, answer, reason, msg, attempt, room)
		timer.Reset(time.Millisecond)
	}
}

func (h *Handler) RetryRoomWork(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	id, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "message")
	if !ok {
		return
	}
	var status string
	err := h.DB.QueryRow(r.Context(), `UPDATE collaboration_work run SET status='queued',updated_at=now(),failure=''
	WHERE run.message_id=$3 AND run.status='failed' AND EXISTS(SELECT r.id`+visibleRoom+`
	AND r.id=(SELECT room_id FROM collaboration_message WHERE id=$3 AND sender_id=$2)) RETURNING run.status`, m.WorkspaceID, m.UserID, id).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		err = h.DB.QueryRow(r.Context(), `UPDATE room_agent_turn turn SET status='pending',updated_at=now(),error=''
        WHERE turn.message_id=$3 AND turn.status='failed' AND EXISTS(SELECT r.id`+visibleRoom+`
        AND r.id=(SELECT room_id FROM collaboration_message WHERE id=$3 AND sender_id=$2)) RETURNING turn.status`, m.WorkspaceID, m.UserID, id).Scan(&status)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, 404, "没有可重试的请求")
		return
	}
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 202, map[string]string{"status": status})
}
