package handler

import (
	"encoding/json"
	"net/http"
)

// File discovery follows the source's visibility. Byte downloads authorize again.
func (h *Handler) WorkspaceFiles(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	var data json.RawMessage
	err := h.DB.QueryRow(r.Context(), `
	WITH available AS (
		SELECT f.id, f.filename, octet_length(f.content) AS size, msg.sender_id AS uploader,
		       r.id AS source_id, r.title AS source_title, 'room' AS kind, msg.created_at,
		       msg.id AS message_id, true AS downloadable
		FROM collaboration_file f
		JOIN collaboration_message msg ON msg.id=f.message_id
		JOIN collaboration_room r ON r.id=msg.room_id
		JOIN collaboration_participant p ON p.room_id=r.id AND p.member_id=$2
		WHERE r.workspace_id=$1
		UNION ALL
		SELECT a.id, a.filename, a.size_bytes, a.uploader_id, i.id, i.title, 'issue', a.created_at,
		       c.id, CASE WHEN a.url LIKE 'db-content:%' THEN EXISTS (
			       SELECT 1 FROM attachment_content bytes WHERE bytes.attachment_id=a.id) ELSE a.url<>'' END
		FROM attachment a
		JOIN comment c ON c.id=a.comment_id AND c.workspace_id=a.workspace_id AND c.deleted_at IS NULL
		JOIN issue i ON i.id=c.issue_id AND i.workspace_id=a.workspace_id
		WHERE a.workspace_id=$1 AND a.chat_session_id IS NULL AND a.chat_message_id IS NULL AND a.source_context_id IS NULL
		  AND (a.task_id IS NULL OR EXISTS (
		      SELECT 1 FROM agent_task_queue t JOIN agent agent ON agent.id=t.agent_id
		      WHERE t.id=a.task_id AND agent.workspace_id=$1 AND t.chat_session_id IS NULL))
		UNION ALL
		SELECT msg.id, a.filename, octet_length(a.content), msg.owner_id, c.id, c.title,
		       'work', msg.updated_at, msg.id, true
		FROM workbench_artifact a JOIN workbench_message msg ON msg.id=a.message_id
		JOIN workbench_conversation c ON c.id=msg.conversation_id
		WHERE msg.workspace_id=$1 AND msg.owner_id=$3 AND msg.status='completed'
		UNION ALL
		SELECT f.id, f.filename, octet_length(f.content), msg.owner_id, c.id, c.title,
		       'input', msg.created_at, msg.id, true
		FROM workbench_input_file f JOIN workbench_message msg ON msg.id=f.message_id
		JOIN workbench_conversation c ON c.id=msg.conversation_id
		WHERE msg.workspace_id=$1 AND msg.owner_id=$3
		UNION ALL
		SELECT f.id, f.filename, f.size_bytes, f.uploader_id, s.id, s.title, 'agent-chat', f.created_at,
		       msg.id, CASE WHEN f.url LIKE 'db-content:%' THEN EXISTS (
			       SELECT 1 FROM attachment_content bytes WHERE bytes.attachment_id=f.id) ELSE f.url<>'' END
		FROM attachment f JOIN chat_message msg ON f.chat_message_id=msg.id AND msg.message_kind!='channel_command'
		JOIN chat_session s ON msg.chat_session_id=s.id AND s.workspace_id=f.workspace_id
		JOIN agent a ON a.id=s.agent_id AND a.workspace_id=s.workspace_id
		JOIN member m ON m.id=$2 AND m.workspace_id=s.workspace_id AND m.user_id=s.creator_id
		WHERE s.workspace_id=$1 AND s.creator_id=$3 AND (f.chat_session_id IS NULL OR f.chat_session_id=s.id)
		  AND (a.owner_id=m.user_id OR m.role IN ('owner','admin') OR (a.permission_mode='public_to' AND EXISTS (
		     SELECT 1 FROM agent_invocation_target t WHERE t.agent_id=a.id AND (t.target_type='workspace' OR (t.target_type='member' AND t.target_id=m.user_id)))))
	)
	SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY created_at DESC,id),'[]') FROM available f
	`, m.WorkspaceID, m.ID, m.UserID).Scan(&data)
	if err != nil {
		roomError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, 200, data)
}
