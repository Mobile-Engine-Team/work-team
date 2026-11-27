package handler

import (
	"context"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type roomMention struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Builtin bool   `json:"builtin"`
	Joined  bool   `json:"joined"`
}

var errRoomMentionChanged = errors.New("selected agent mention changed")

func (h *Handler) RoomMentions(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	room, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "room")
	if !ok {
		return
	}
	ctx := r.Context()
	var squad pgtype.UUID
	var kind string
	if err := h.DB.QueryRow(ctx, "SELECT r.kind,r.squad_id"+visibleRoom+" AND r.id=$3", m.WorkspaceID, m.UserID, room).Scan(&kind, &squad); err != nil {
		roomError(w, err)
		return
	}
	agents, err := h.Queries.ListAgents(ctx, m.WorkspaceID)
	if err != nil {
		roomError(w, err)
		return
	}
	uid, ws := uuidToString(m.UserID), uuidToString(m.WorkspaceID)
	allowed := map[pgtype.UUID]bool{}
	if squad.Valid {
		rows, err := h.DB.Query(ctx, `SELECT leader_id FROM squad WHERE id=$1 AND workspace_id=$2 AND archived_at IS NULL UNION SELECT sm.member_id FROM squad_member sm JOIN squad s ON s.id=sm.squad_id AND s.archived_at IS NULL WHERE s.id=$1 AND s.workspace_id=$2 AND sm.member_type='agent'`, squad, m.WorkspaceID)
		if err != nil {
			roomError(w, err)
			return
		}
		for rows.Next() {
			var id pgtype.UUID
			if err = rows.Scan(&id); err != nil {
				rows.Close()
				roomError(w, err)
				return
			}
			allowed[id] = true
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			roomError(w, err)
			return
		}
	}
	joined, err := h.DB.Query(ctx, `SELECT ra.agent_id FROM collaboration_room_agent ra JOIN collaboration_room r ON r.id=ra.room_id JOIN collaboration_participant p ON p.room_id=r.id WHERE r.workspace_id=$1 AND p.member_id=$2 AND r.id=$3`, m.WorkspaceID, m.ID, room)
	if err != nil {
		roomError(w, err)
		return
	}
	memberIDs := map[pgtype.UUID]bool{}
	for joined.Next() {
		var id pgtype.UUID
		if err = joined.Scan(&id); err != nil {
			joined.Close()
			roomError(w, err)
			return
		}
		memberIDs[id] = true
	}
	err = joined.Err()
	joined.Close()
	if err != nil {
		roomError(w, err)
		return
	}
	result := []roomMention{}
	for _, a := range agents {
		builtin := a.SystemKey.Valid && a.SystemKey.String == "mobilework"
		if a.ArchivedAt.Valid || (squad.Valid && !allowed[a.ID]) || (builtin && kind != "group") || !h.canInvokeAgent(ctx, a, "member", uid, uid, ws) {
			continue
		}
		name := a.Name
		if builtin {
			name = "Work"
		}
		result = append(result, roomMention{ID: uuidToString(a.ID), Name: name, Builtin: builtin, Joined: memberIDs[a.ID]})
	}
	writeJSON(w, 200, result)
}

// A selected ID is reauthorized at send time. The caller's committed receipt
// is checked first, so a replay after a squad change cannot create another run.
func (h *Handler) authorizedRoomAgent(ctx context.Context, tx pgx.Tx, m db.Member, room, agent pgtype.UUID, mention *string) (db.Agent, error) {
	q := h.Queries.WithTx(tx)
	a, err := q.GetAgentInWorkspace(ctx, db.GetAgentInWorkspaceParams{ID: agent, WorkspaceID: m.WorkspaceID})
	if err != nil {
		return a, err
	}
	uid := uuidToString(m.UserID)
	if a.ArchivedAt.Valid || !h.canInvokeAgent(ctx, a, "member", uid, uid, uuidToString(m.WorkspaceID)) {
		return a, pgx.ErrNoRows
	}
	name := a.Name
	if a.SystemKey.Valid && a.SystemKey.String == "mobilework" {
		name = "Work"
	}
	var allowed, matches bool
	err = tx.QueryRow(ctx, `SELECT (r.squad_id IS NULL OR EXISTS(SELECT 1 FROM squad s WHERE s.id=r.squad_id AND s.archived_at IS NULL AND (s.leader_id=$2 OR EXISTS(SELECT 1 FROM squad_member sm WHERE sm.squad_id=s.id AND sm.member_type='agent' AND sm.member_id=$2)))) AND (r.kind='group' OR NOT $3), ($5::text IS NULL OR room_names_agent($5,$6)) FROM collaboration_room r WHERE r.id=$1 AND r.workspace_id=$4`, room, agent, name == "Work" && a.SystemKey.Valid, m.WorkspaceID, mention, name).Scan(&allowed, &matches)
	if err == nil && !allowed {
		err = pgx.ErrNoRows
	}
	if err == nil && !matches {
		err = errRoomMentionChanged
	}
	return a, err
}
