package handler

import (
	"context"
	"errors"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"net/http"
	"strings"
	"time"
)

func (h *Handler) SquadRoom(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	id, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "squad")
	if !ok {
		return
	}
	ctx := r.Context()
	tx, err := h.TxStarter.Begin(ctx)
	if err != nil {
		roomError(w, err)
		return
	}
	defer tx.Rollback(ctx)
	var name string
	var leader pgtype.UUID
	err = tx.QueryRow(ctx, "SELECT name,leader_id FROM squad WHERE id=$1 AND workspace_id=$2 AND archived_at IS NULL FOR UPDATE", id, m.WorkspaceID).Scan(&name, &leader)
	if err != nil {
		roomError(w, err)
		return
	}
	if status, msg := h.validateAssigneePair(ctx, r, uuidToString(m.WorkspaceID), pgtype.Text{String: "agent", Valid: true}, leader); status != 0 {
		writeError(w, status, msg)
		return
	}
	var room string
	// Reuse only conversations the caller already participates in.
	err = tx.QueryRow(ctx, "SELECT r.id"+visibleRoom+" AND r.squad_id=$3 ORDER BY r.created_at LIMIT 1", m.WorkspaceID, m.UserID, id).Scan(&room)
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, "INSERT INTO collaboration_room(workspace_id,owner_id,kind,title,squad_id) VALUES($1,$2,'group',$3,$4) RETURNING id", m.WorkspaceID, m.UserID, name, id).Scan(&room)
		if err == nil {
			_, err = tx.Exec(ctx, `INSERT INTO collaboration_participant SELECT $1,mem.id FROM member mem WHERE mem.workspace_id=$2 AND (mem.id=$3 OR EXISTS (SELECT 1 FROM squad_member s WHERE s.squad_id=$4 AND s.member_type='member' AND s.member_id=mem.user_id))`, room, m.WorkspaceID, m.ID, id)
		}
	}
	if err == nil {
		err = tx.Commit(ctx)
	}
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, map[string]string{"id": room})
}

func (h *Handler) RunRoomAgents(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			var msg, agent, room, uid, ws, session pgtype.UUID
			var title, prompt string
			var attempt int
			err := h.DB.QueryRow(ctx, `WITH pick AS (SELECT message_id FROM room_agent_turn WHERE status='pending' OR (status='dispatching' AND updated_at<now()-interval '2 minutes') ORDER BY updated_at FOR UPDATE SKIP LOCKED LIMIT 1)
			UPDATE room_agent_turn t SET status='dispatching',attempt=t.attempt+1,updated_at=now()
			FROM pick,collaboration_message m,collaboration_room r WHERE t.message_id=pick.message_id AND m.id=t.message_id AND r.id=m.room_id
			RETURNING m.id,t.agent_id,r.id,m.sender_id,r.workspace_id,t.session_id,r.title,m.content,t.attempt`).Scan(&msg, &agent, &room, &uid, &ws, &session, &title, &prompt, &attempt)
			if err != nil {
				continue
			}
			task, dispatchErr := h.sendRoomAgent(ctx, msg, agent, room, uid, ws, session, title, prompt, attempt)
			status, reason := "submitted", ""
			if dispatchErr != nil {
				status = "failed"
				reason = "未能入队，请检查智能体权限和运行时绑定后重试"
			}
			_, _ = h.DB.Exec(ctx, "UPDATE room_agent_turn SET status=$3,error=$4,task_id=$5,updated_at=now() WHERE message_id=$1 AND attempt=$2 AND status='dispatching'", msg, attempt, status, reason, task)
		}
	}
}
func (h *Handler) sendRoomAgent(ctx context.Context, msg, agent, room, uid, ws, session pgtype.UUID, title, prompt string, attempt int) (pgtype.UUID, error) {
	var empty pgtype.UUID
	m, err := h.getWorkspaceMember(ctx, uuidToString(uid), uuidToString(ws))
	if err != nil || m.Role == "guest" {
		return empty, errors.New("成员不可用")
	}
	var visible bool
	if err = h.DB.QueryRow(ctx, "SELECT EXISTS(SELECT r.id"+visibleRoom+" AND r.id=$3)", ws, uid, room).Scan(&visible); err != nil || !visible {
		return empty, errors.New("会话不可用")
	}
	a, err := h.Queries.GetAgentInWorkspace(ctx, db.GetAgentInWorkspaceParams{ID: agent, WorkspaceID: ws})
	if err != nil || a.ArchivedAt.Valid || !a.RuntimeID.Valid || !h.canInvokeAgent(ctx, a, "member", uuidToString(uid), uuidToString(uid), uuidToString(ws)) {
		return empty, errors.New("智能体不可用")
	}
	if !session.Valid {
		err = h.DB.QueryRow(ctx, `WITH created AS(INSERT INTO chat_session(workspace_id,agent_id,creator_id,title) SELECT $1,$2,$3,$4 FROM room_agent_turn WHERE message_id=$5 AND attempt=$6 AND session_id IS NULL AND status='dispatching' FOR UPDATE RETURNING id)
        UPDATE room_agent_turn SET session_id=created.id FROM created WHERE message_id=$5 RETURNING session_id`, ws, agent, uid, title, msg, attempt).Scan(&session)
		if err != nil {
			return empty, err
		}
	}
	chat, err := h.Queries.GetChatSession(ctx, session)
	if err != nil {
		return empty, err
	}
	result, err := h.TaskService.SendDirectChatMessage(ctx, chat, a, uid, strings.TrimSpace(prompt), nil, "member", uid, msg)
	if err != nil {
		return empty, err
	}
	return result.Task.ID, nil
}
