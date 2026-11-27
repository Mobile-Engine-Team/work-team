package handler

import "net/http"

// RuntimeLoad exposes counts only for devices the caller can use in this workspace.
func (h *Handler) RuntimeLoad(w http.ResponseWriter, r *http.Request) {
	member, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	rows, err := h.DB.Query(r.Context(), `
		SELECT rt.id::text,
		  count(q.id) FILTER (WHERE q.status='running'),
		  count(q.id) FILTER (WHERE q.status IN ('dispatched','waiting_local_directory'))
		FROM agent_runtime rt
		LEFT JOIN agent_task_queue q ON q.runtime_id=rt.id
		  AND q.status IN ('running','dispatched','waiting_local_directory')
		WHERE rt.workspace_id=$1 AND (rt.owner_id=$2 OR rt.visibility='public'
		  OR (rt.visibility='private' AND $2=ANY(rt.shared_with)))
		GROUP BY rt.id`, member.WorkspaceID, member.UserID)
	if err != nil {
		roomError(w, err)
		return
	}
	defer rows.Close()
	type counts struct {
		Running  int `json:"running"`
		Assigned int `json:"assigned"`
	}
	result := map[string]counts{}
	for rows.Next() {
		var id string
		var c counts
		if err := rows.Scan(&id, &c.Running, &c.Assigned); err != nil {
			roomError(w, err)
			return
		}
		result[id] = c
	}
	if err := rows.Err(); err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
