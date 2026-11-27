package handler

import (
	"encoding/json"
	"github.com/go-chi/chi/v5"
	"github.com/multica-ai/multica/server/internal/workbench"
	"net/http"
	"time"
)

func (h *Handler) ProjectReceipts(w http.ResponseWriter, r *http.Request) {
	p, _, ok := h.projectAccess(w, r, false, false)
	if !ok {
		return
	}
	var data json.RawMessage
	err := h.DB.QueryRow(r.Context(), `SELECT coalesce(jsonb_agg(to_jsonb(recent) ORDER BY created_at DESC),'[]') FROM (
 SELECT h.issue_id,h.version,h.request_id,h.created_at,h.result->>'status' AS handoff,h.result->>'reason' AS reason,i.title,t.status AS execution
 FROM project_start_request h JOIN issue i ON i.id=h.issue_id AND i.workspace_id=$2 LEFT JOIN agent_task_queue t ON t.issue_id=i.id AND t.id::text=h.result->>'task_id'
 WHERE h.project_id=$1 ORDER BY h.created_at DESC LIMIT 100) recent`, p.ID, p.WorkspaceID).Scan(&data)
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, data)
}
func (h *Handler) PinVersions(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	id, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "pin")
	if !ok {
		return
	}
	ctx := r.Context()
	c, err := workbench.Load(ctx, h.DB, uuidToString(m.WorkspaceID), time.Now())
	if err != nil {
		roomError(w, err)
		return
	}
	rows, err := h.DB.Query(ctx, `SELECT v.revision,v.result,v.created_at FROM work_pin_version v JOIN saved_view s ON s.id=v.pin_id WHERE s.id=$3 AND s.workspace_id=$1 AND s.owner_id=$2 ORDER BY v.revision DESC`, m.WorkspaceID, m.UserID, id)
	if err != nil {
		roomError(w, err)
		return
	}
	defer rows.Close()
	versions := []map[string]any{}
	for rows.Next() {
		var rev int
		var raw []byte
		var created time.Time
		if err = rows.Scan(&rev, &raw, &created); err != nil {
			roomError(w, err)
			return
		}
		result := benchDecodeResult(raw)
		if result != nil && benchVisible(result, c) {
			versions = append(versions, map[string]any{"revision": rev, "result": result, "created_at": created})
		}
	}
	if rows.Err() != nil {
		roomError(w, rows.Err())
		return
	}
	writeJSON(w, 200, versions)
}
