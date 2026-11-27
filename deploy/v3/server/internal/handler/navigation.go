package handler

import (
	"encoding/json"
	"net/http"
)

// Navigation reads the current member's conversations, task relationships and
// unread receipts in one snapshot. Project membership never grants room access.
func (h *Handler) Navigation(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	var data json.RawMessage
	err := h.DB.QueryRow(r.Context(), `WITH rooms AS (
		SELECT r.id,r.title,r.project_id,r.created_at`+visibleRoom+`
	), linked AS (
		SELECT msg.room_id,s.issue_id,i.project_id FROM rooms r
		JOIN collaboration_message msg ON msg.room_id=r.id
		JOIN issue_message_source s ON s.message_id=msg.id
		JOIN issue i ON i.id=s.issue_id AND i.workspace_id=$1
	), notices AS (
		SELECT * FROM inbox_item WHERE workspace_id=$1 AND recipient_type='member' AND recipient_id=$2 AND NOT read AND NOT archived
	), items AS (
		SELECT r.id,r.title,'room' AS kind,
			coalesce(r.project_id,(SELECT l.project_id FROM linked l WHERE l.room_id=r.id AND l.project_id IS NOT NULL ORDER BY l.issue_id LIMIT 1)) AS project_id,
			(r.project_id IS NOT NULL OR EXISTS(SELECT 1 FROM linked l WHERE l.room_id=r.id)) AS related,
			'' AS status,coalesce((SELECT max(created_at) FROM collaboration_message WHERE room_id=r.id),r.created_at) AS latest,
			notice.total AS unread,CASE WHEN notice.mentioned THEN '@' ELSE '' END AS tag
		FROM rooms r CROSS JOIN LATERAL (
			SELECT count(*) AS total,bool_or(n.details->>'mentioned'='true') AS mentioned FROM notices n
			WHERE n.type='room_message' AND n.details->>'room_id'=r.id::text
		) notice
		UNION ALL
		SELECT i.id,i.title,'issue',i.project_id,true,i.status,i.updated_at,n.total,
			CASE WHEN n.mentioned THEN '@' WHEN n.assigned THEN '新' ELSE '' END
		FROM issue i
		CROSS JOIN LATERAL (SELECT count(*) AS total,bool_or(type IN ('mention','mentioned')) AS mentioned,
			bool_or(type IN ('issue_assigned','assignment','assigned','project_handoff')) AS assigned FROM notices WHERE issue_id=i.id) n
		WHERE i.workspace_id=$1 AND (n.total>0 OR (i.assignee_type='member' AND i.assignee_id=$2)
			OR EXISTS(SELECT 1 FROM issue_subscriber s WHERE s.issue_id=i.id AND s.user_type='member' AND s.user_id=$2)
			OR EXISTS(SELECT 1 FROM linked l WHERE l.issue_id=i.id)
			OR EXISTS(SELECT 1 FROM work_message_task s JOIN workbench_message msg ON msg.id=s.message_id
				WHERE s.issue_id=i.id AND msg.workspace_id=$1 AND msg.owner_id=$2))
		UNION ALL
		SELECT c.id,c.title,'work',NULL,false,'',coalesce((SELECT max(updated_at) FROM workbench_message msg
			WHERE msg.conversation_id=c.id AND msg.workspace_id=$1 AND msg.owner_id=$2),c.created_at),0,''
		FROM workbench_conversation c WHERE c.workspace_id=$1 AND c.owner_id=$2
		UNION ALL
		SELECT c.id,coalesce(nullif(c.title,''),a.name),'agent',NULL,false,'',coalesce(activity.latest,c.updated_at),activity.unread,''
		FROM chat_session c JOIN agent a ON a.id=c.agent_id AND a.workspace_id=c.workspace_id
		CROSS JOIN LATERAL (SELECT max(created_at) AS latest,count(*) FILTER (WHERE role='assistant' AND created_at>c.last_read_at) AS unread
			FROM chat_message WHERE chat_session_id=c.id AND message_kind!='channel_command') activity
		WHERE c.workspace_id=$1 AND c.creator_id=$2 AND c.status='active' AND a.archived_at IS NULL
			AND (c.explicitly_created_at IS NOT NULL OR activity.latest IS NOT NULL)
			AND NOT EXISTS(SELECT 1 FROM room_agent_turn t WHERE t.session_id=c.id)
			AND (a.owner_id=$2 OR $3 IN ('owner','admin') OR (a.permission_mode='public_to' AND EXISTS (
				SELECT 1 FROM agent_invocation_target t WHERE t.agent_id=a.id AND (t.target_type='workspace' OR (t.target_type='member' AND t.target_id=$2)))))
	) SELECT coalesce(jsonb_agg(to_jsonb(items)||jsonb_build_object('project_title',p.title) ORDER BY latest DESC,items.kind,items.id),'[]')
	FROM items LEFT JOIN project p ON p.id=items.project_id AND p.workspace_id=$1`, m.WorkspaceID, m.UserID, m.Role).Scan(&data)
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, data)
}
