package handler

import (
	"encoding/json"
	"github.com/go-chi/chi/v5"
	"net/http"
	"strings"
)

func (h *Handler) SearchWorkspace(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" || len([]rune(q)) > 200 {
		writeError(w, 422, "请输入有效搜索内容")
		return
	}
	var rows json.RawMessage
	err := h.DB.QueryRow(r.Context(), `SELECT coalesce(jsonb_agg(to_jsonb(results) ORDER BY title,id),'[]') FROM (
 SELECT * FROM (
 SELECT i.id,i.title,'issue' AS kind,i.id AS source_id FROM issue i JOIN workspace ws ON ws.id=i.workspace_id WHERE i.workspace_id=$1 AND strpos(lower(i.title||' '||ws.issue_prefix||'-'||i.number::text||' '||coalesce(i.description,'')),lower($3))>0
 UNION ALL SELECT p.id,p.title,'project',p.id FROM project p WHERE workspace_id=$1 AND strpos(lower(p.title),lower($3))>0
 UNION ALL SELECT r.id,r.title,'room',r.id`+visibleRoom+` AND strpos(lower(r.title),lower($3))>0
 UNION ALL SELECT msg.id,left(msg.content,100),'room-message',msg.room_id FROM collaboration_message msg WHERE msg.room_id IN(SELECT r.id`+visibleRoom+`) AND strpos(lower(msg.content),lower($3))>0
 UNION ALL SELECT c.id,c.title,'work',c.id FROM workbench_conversation c WHERE c.workspace_id=$1 AND owner_id=$2 AND strpos(lower(c.title),lower($3))>0
 UNION ALL SELECT msg.id,left(msg.prompt,100),'work',msg.conversation_id FROM workbench_message msg WHERE msg.workspace_id=$1 AND owner_id=$2 AND strpos(lower(msg.prompt),lower($3))>0
 ) visible ORDER BY title,id LIMIT 100) results`, m.WorkspaceID, m.UserID, q).Scan(&rows)
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, rows)
}

// Return only messages in the selected room and its explicitly linked or project tasks.
func (h *Handler) SearchRoom(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	id, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "room")
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" || len([]rune(q)) > 200 {
		writeError(w, 422, "请输入有效搜索内容")
		return
	}
	var results json.RawMessage
	err := h.DB.QueryRow(r.Context(), `WITH permitted AS (SELECT r.id,r.project_id,r.workspace_id`+visibleRoom+` AND r.id=$3),
    matches AS (
      SELECT msg.id,'message' AS kind,coalesce(nullif(msg.content,''),msg.filename) AS title,msg.created_at FROM permitted r
        JOIN collaboration_message msg ON msg.room_id=r.id
        WHERE strpos(lower(concat_ws(' ',msg.content,msg.filename)),lower($4))>0
      UNION ALL
      SELECT i.id,'issue',i.title,i.created_at FROM permitted r JOIN issue i ON i.workspace_id=r.workspace_id
        WHERE (i.project_id=r.project_id OR EXISTS (
          SELECT 1 FROM collaboration_message msg WHERE msg.room_id=r.id AND (EXISTS(SELECT 1 FROM issue_message_source src WHERE src.message_id=msg.id AND src.issue_id=i.id)
          OR EXISTS(SELECT 1 FROM room_task_receipt receipt WHERE receipt.message_id=msg.id AND receipt.issue_id=i.id))))
          AND strpos(lower(i.title),lower($4))>0
    ) SELECT (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC,t.id),'[]') FROM
      (SELECT * FROM matches ORDER BY created_at DESC,id LIMIT 100)t) FROM permitted`, m.WorkspaceID, m.UserID, id, q).Scan(&results)
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, results)
}
