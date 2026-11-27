package handler

import (
	"encoding/json"
	"errors"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/service"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"mime"
	"net/http"
	"strings"
)

const visibleRoom = ` FROM collaboration_room r JOIN collaboration_participant p ON p.room_id=r.id
    JOIN member m ON m.id=p.member_id AND m.workspace_id=r.workspace_id
    WHERE r.workspace_id=$1 AND m.user_id=$2 `

func roomError(w http.ResponseWriter, err error) {
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, 404, "对象不可用")
		return
	}
	planWriteError(w, err)
}

func (h *Handler) RoomList(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	var data json.RawMessage
	err := h.DB.QueryRow(r.Context(), `SELECT coalesce(jsonb_agg(to_jsonb(rooms) ORDER BY latest DESC,id),'[]') FROM (
        SELECT r.id,r.title,r.kind,r.project_id,(SELECT count(*) FROM inbox_item n WHERE n.workspace_id=$1 AND n.recipient_id=$2 AND n.type='room_message' AND NOT n.read AND n.details->>'room_id'=r.id::text) AS unread,coalesce((SELECT max(created_at) FROM collaboration_message WHERE room_id=r.id),r.created_at) AS latest`+
		visibleRoom+` AND ($3='' OR strpos(lower(r.title),lower($3))>0 OR EXISTS(SELECT 1 FROM collaboration_message msg WHERE msg.room_id=r.id AND strpos(lower(msg.content),lower($3))>0))) rooms`, m.WorkspaceID, m.UserID, r.URL.Query().Get("q")).Scan(&data)
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, data)
}

func (h *Handler) CreateRoom(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	var body struct {
		Files                []workInput `json:"files,omitempty"`
		Title, Kind, Content string
		RequestID            string `json:"request_id"`
		Members              []string
		ProjectID            string `json:"project_id"`
	}
	if !decodeWithFiles(w, r, &body) || !validWorkInputs(w, body.Files) {
		return
	}
	if len(body.Files) > 0 && body.RequestID == "" {
		writeError(w, 422, "附件需要消息请求标识")
		return
	}
	body.Title = strings.TrimSpace(body.Title)
	if body.Title == "" || len([]rune(body.Title)) > 100 || len(body.Members) == 0 || len(body.Members) > 100 || (body.Kind != "direct" && body.Kind != "group") {
		writeError(w, 422, "请填写会话名称并选择参与成员")
		return
	}
	ctx := r.Context()
	tx, err := h.TxStarter.Begin(ctx)
	if err != nil {
		roomError(w, err)
		return
	}
	defer tx.Rollback(ctx)
	var key pgtype.UUID
	if body.RequestID != "" {
		key, ok = parseUUIDOrBadRequest(w, body.RequestID, "request_id")
		if !ok {
			return
		}
		if len(body.Content) > 64000 {
			writeError(w, 422, "消息过长")
			return
		}
		if _, err = tx.Exec(ctx, "SELECT id FROM member WHERE id=$1 FOR UPDATE", m.ID); err != nil {
			roomError(w, err)
			return
		}
		var previous string
		var matches bool
		err = tx.QueryRow(ctx, `SELECT receipt.room_id,receipt.input=$3::jsonb FROM room_creation_receipt receipt
 JOIN collaboration_participant cp ON cp.room_id=receipt.room_id AND cp.member_id=receipt.member_id WHERE receipt.member_id=$1 AND receipt.request_id=$2`, m.ID, key, receiptWithFiles(body, body.Files)).Scan(&previous, &matches)
		if err == nil {
			if !matches {
				writeError(w, 409, "同一请求不能更改会话")
				return
			}
			writeJSON(w, 200, map[string]string{"id": previous})
			return
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			roomError(w, err)
			return
		}
	}
	var project pgtype.UUID
	if body.ProjectID != "" {
		id, ok := parseUUIDOrBadRequest(w, body.ProjectID, "project_id")
		if !ok {
			return
		}
		err = tx.QueryRow(ctx, "SELECT id FROM project WHERE id=$1 AND workspace_id=$2 FOR KEY SHARE", id, m.WorkspaceID).Scan(&project)
		if err != nil {
			roomError(w, err)
			return
		}
	}
	var id string
	err = tx.QueryRow(ctx, `INSERT INTO collaboration_room(workspace_id,owner_id,title,kind,project_id) VALUES($1,$2,$3,$4,$5) RETURNING id`, m.WorkspaceID, m.UserID, body.Title, body.Kind, project).Scan(&id)
	if err != nil {
		roomError(w, err)
		return
	}
	members := map[pgtype.UUID]bool{m.UserID: true}
	for _, raw := range body.Members {
		uid, ok := parseUUIDOrBadRequest(w, raw, "member")
		if !ok {
			return
		}
		members[uid] = true
	}
	if len(members) < 2 || (body.Kind == "direct" && len(members) != 2) {
		writeError(w, 422, "请选择其他工作区成员")
		return
	}
	for uid := range members {
		tag, err := tx.Exec(ctx, `INSERT INTO collaboration_participant(room_id,member_id) SELECT $1,id FROM member WHERE workspace_id=$2 AND user_id=$3`, id, m.WorkspaceID, uid)
		if err != nil {
			roomError(w, err)
			return
		}
		if tag.RowsAffected() != 1 {
			writeError(w, 422, "成员不可用")
			return
		}
	}
	if key.Valid {
		_, err = tx.Exec(ctx, "INSERT INTO room_creation_receipt VALUES($1,$2,$3,$4)", m.ID, key, id, receiptWithFiles(body, body.Files))
		if err == nil && strings.TrimSpace(body.Content) != "" {
			_, err = tx.Exec(ctx, `INSERT INTO collaboration_message(room_id,sender_id,request_id,content) VALUES($1,$2,$3,$4)`, id, m.UserID, key, body.Content)
		}
		for _, f := range body.Files {
			if err != nil {
				break
			}
			_, err = tx.Exec(ctx, `INSERT INTO collaboration_message(room_id,sender_id,request_id,content,filename,file_bytes) VALUES($1,$2,gen_random_uuid(),'', $3,$4)`, id, m.UserID, f.Filename, f.Bytes)
		}
		if err != nil {
			roomError(w, err)
			return
		}
	}
	if err = tx.Commit(ctx); err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 201, map[string]string{"id": id})
}

func (h *Handler) RoomDetail(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	id, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "room")
	if !ok {
		return
	}
	var data json.RawMessage
	err := h.DB.QueryRow(r.Context(), `SELECT jsonb_build_object('id',r.id,'title',r.title,'revision',r.revision,'owner_id',r.owner_id,'kind',r.kind,'project_id',r.project_id,'members',
        (SELECT jsonb_agg(member.user_id) FROM collaboration_participant cp JOIN member ON member.id=cp.member_id WHERE cp.room_id=r.id),
        'project_title',(SELECT p.title FROM project p WHERE p.id=r.project_id AND p.workspace_id=r.workspace_id),
        'linked_tasks',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'title',i.title) ORDER BY i.number),'[]')
            FROM issue i WHERE i.workspace_id=r.workspace_id AND i.id IN (
              SELECT s.issue_id FROM issue_message_source s JOIN collaboration_message cm ON cm.id=s.message_id WHERE cm.room_id=r.id
              UNION SELECT s.issue_id FROM room_task_receipt s JOIN collaboration_message cm ON cm.id=s.message_id WHERE cm.room_id=r.id)),
        'messages',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',msg.id,'sender_id',msg.sender_id,'content',msg.content,'filename',msg.filename,'created_at',msg.created_at,
        'files',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'filename',f.filename) ORDER BY f.position),'[]') FROM collaboration_file f WHERE f.message_id=msg.id),
        'agent',(SELECT jsonb_build_object('name',a.name,'status',coalesce(t.status,turn.status),'error',turn.error,'answer',(SELECT coalesce(string_agg(cm.content,E'\n' ORDER BY cm.created_at,cm.id),'') FROM chat_message cm WHERE cm.chat_session_id=turn.session_id AND cm.task_id=turn.task_id AND cm.role='assistant')) FROM room_agent_turn turn JOIN agent a ON a.id=turn.agent_id LEFT JOIN agent_task_queue t ON t.id=turn.task_id WHERE turn.message_id=msg.id),
        'work',(SELECT jsonb_build_object('status',w.status,'answer',w.answer,'failure',w.failure) FROM collaboration_work w WHERE w.message_id=msg.id),
        'tasks',(SELECT coalesce(jsonb_agg(i.id),'[]') FROM (SELECT issue_id FROM issue_message_source WHERE message_id=msg.id UNION SELECT issue_id FROM room_task_receipt WHERE message_id=msg.id) s JOIN issue i ON i.id=s.issue_id WHERE true AND i.workspace_id=r.workspace_id)) ORDER BY msg.created_at,msg.id),'[]') FROM collaboration_message msg WHERE msg.room_id=r.id))`+visibleRoom+" AND r.id=$3", m.WorkspaceID, m.UserID, id).Scan(&data)
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, data)
}

func (h *Handler) RoomPost(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	id, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "room")
	if !ok {
		return
	}
	var body struct {
		AgentID           string `json:"agent_id"`
		RequestID         string `json:"request_id"`
		Content, Filename string
		Bytes             []byte
		Files             []workInput `json:"files"`
	}
	if !decodeWithFiles(w, r, &body) {
		return
	}
	req, ok := parseUUIDOrBadRequest(w, body.RequestID, "request_id")
	if !ok {
		return
	}
	var selected pgtype.UUID
	if body.AgentID != "" {
		selected, ok = parseUUIDOrBadRequest(w, body.AgentID, "agent_id")
		if !ok {
			return
		}
	}
	body.Content = strings.TrimSpace(body.Content)
	if body.Filename != "" || body.Bytes != nil {
		if len(body.Files) != 0 {
			writeError(w, 422, "请使用一种附件格式")
			return
		}
		body.Files = []workInput{{Filename: body.Filename, Bytes: body.Bytes}}
	}
	if !validWorkInputs(w, body.Files) {
		return
	}
	if len(body.Content) > 64000 || (body.Content == "" && len(body.Files) == 0) {
		writeError(w, 422, "消息或附件无效")
		return
	}
	var extras []workInput
	if len(body.Files) > 0 {
		body.Filename, body.Bytes = body.Files[0].Filename, body.Files[0].Bytes
		extras = body.Files[1:]
	}
	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		roomError(w, err)
		return
	}
	defer tx.Rollback(r.Context())
	var out string
	err = tx.QueryRow(r.Context(), `INSERT INTO collaboration_message(room_id,sender_id,request_id,content,filename,file_bytes,selected_agent_id)
        SELECT r.id,$2,$4,$5,$6,$7,$8`+visibleRoom+` AND r.id=$3
        ON CONFLICT(room_id,sender_id,request_id) DO NOTHING RETURNING id`, m.WorkspaceID, m.UserID, id, req, body.Content, body.Filename, body.Bytes, selected).Scan(&out)
	if errors.Is(err, pgx.ErrNoRows) {
		// A retry reads the first delivery decision, even after a squad rotates its leader.
		err = tx.QueryRow(r.Context(), `SELECT msg.id FROM collaboration_message msg WHERE msg.sender_id=$2 AND msg.request_id=$4 AND msg.content=$5 AND msg.filename=$6 AND msg.file_bytes IS NOT DISTINCT FROM $7 AND msg.selected_agent_id IS NOT DISTINCT FROM $8
    AND msg.room_id IN (SELECT r.id`+visibleRoom+` AND r.id=$3)`,
			m.WorkspaceID, m.UserID, id, req, body.Content, body.Filename, body.Bytes, selected).Scan(&out)
		if err != nil {
			roomError(w, err)
			return
		}
		names := make([]string, 0, len(extras))
		contents := make([][]byte, 0, len(extras))
		for _, f := range extras {
			names = append(names, f.Filename)
			contents = append(contents, f.Bytes)
		}
		var same bool
		err = tx.QueryRow(r.Context(), `SELECT ARRAY(SELECT filename FROM collaboration_extra_file WHERE message_id=$1 ORDER BY position)=$2::text[]
           AND ARRAY(SELECT content FROM collaboration_extra_file WHERE message_id=$1 ORDER BY position)=$3::bytea[]`, out, names, contents).Scan(&same)
		if err != nil {
			roomError(w, err)
			return
		}
		if !same {
			writeError(w, 409, "请求编号已用于不同附件")
			return
		}
		writeJSON(w, 200, map[string]string{"id": out})
		return
	}
	if err != nil {
		roomError(w, err)
		return
	}
	var chosen db.Agent
	if selected.Valid {
		chosen, err = h.authorizedRoomAgent(r.Context(), tx, m, id, selected, &body.Content)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeError(w, 404, "会话中的智能体不可用")
			} else if errors.Is(err, errRoomMentionChanged) {
				writeError(w, 409, "提及名称已更新，请重新选择智能体")
			} else {
				roomError(w, err)
			}
			return
		}
	}
	for i, f := range extras {
		if _, err = tx.Exec(r.Context(), "INSERT INTO collaboration_extra_file(message_id, position, filename, content) VALUES($1,$2,$3,$4)", out, i+1, f.Filename, f.Bytes); err != nil {
			roomError(w, err)
			return
		}
	}
	lines := strings.Split(body.Content, "\n")
	if strings.HasPrefix(strings.ToLower(body.Content), "@work ") && strings.Contains(lines[0], "创建任务") && len(lines) > 1 {
		title := strings.TrimSpace(lines[len(lines)-1])
		if title == "" || len([]rune(title)) > 200 {
			writeError(w, 422, "请在末行填写任务标题（最多 200 字）")
			return
		}
		err = h.createRoomTask(r.Context(), tx, m, id, out, req, title)
	} else if selected.Valid {
		if chosen.SystemKey.Valid && chosen.SystemKey.String == "mobilework" {
			_, err = tx.Exec(r.Context(), "INSERT INTO collaboration_work(message_id) VALUES($1) ON CONFLICT DO NOTHING", out)
		} else {
			// The selection wins if the same message also contains a textual @Work.
			_, err = tx.Exec(r.Context(), "DELETE FROM collaboration_work WHERE message_id=$1", out)
			if err == nil {
				_, err = tx.Exec(r.Context(), "INSERT INTO room_agent_turn(message_id,agent_id) VALUES($1,$2)", out, selected)
			}
		}
	} else {
		var target pgtype.UUID
		var builtin bool
		lookup := tx.QueryRow(r.Context(), `SELECT a.id,coalesce(a.system_key='mobilework',false) FROM collaboration_room r
          LEFT JOIN squad s ON r.squad_id=s.id AND s.archived_at IS NULL
          JOIN agent a ON a.workspace_id=r.workspace_id AND a.archived_at IS NULL
          WHERE r.id=$1 AND NOT EXISTS(SELECT 1 FROM collaboration_work WHERE message_id=$3) AND (
            (r.squad_id IS NULL AND a.system_key IS NULL AND room_names_agent($2,a.name))
            OR (s.id IS NOT NULL AND (a.id=s.leader_id OR (room_names_agent($2,a.name) AND EXISTS(SELECT 1 FROM squad_member sm WHERE sm.squad_id=s.id AND sm.member_type='agent' AND sm.member_id=a.id)))))
          ORDER BY (room_names_agent($2,a.name)) DESC,length(a.name) DESC,a.id LIMIT 1`, id, body.Content, out).Scan(&target, &builtin)
		if lookup == nil && builtin {
			_, err = tx.Exec(r.Context(), "INSERT INTO collaboration_work(message_id) VALUES($1) ON CONFLICT DO NOTHING", out)
		} else if lookup == nil {
			agent, e := h.Queries.GetAgentInWorkspace(r.Context(), db.GetAgentInWorkspaceParams{ID: target, WorkspaceID: m.WorkspaceID})
			if e != nil {
				err = e
			} else if h.canInvokeAgent(r.Context(), agent, "member", uuidToString(m.UserID), uuidToString(m.UserID), uuidToString(m.WorkspaceID)) {
				_, err = tx.Exec(r.Context(), "INSERT INTO room_agent_turn(message_id,agent_id) VALUES($1,$2) ON CONFLICT DO NOTHING", out, target)
			}
		} else if !errors.Is(lookup, pgx.ErrNoRows) {
			err = lookup
		}
	}
	if err == nil {
		err = tx.Commit(r.Context())
	}
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, map[string]string{"id": out})
}

func (h *Handler) RoomFile(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	id, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "message")
	if !ok {
		return
	}
	var name string
	var bytes []byte
	err := h.DB.QueryRow(r.Context(), `SELECT f.filename,f.content FROM collaboration_file f JOIN collaboration_message msg ON msg.id=f.message_id WHERE f.id=$3 AND msg.room_id IN (SELECT r.id`+visibleRoom+")", m.WorkspaceID, m.UserID, id).Scan(&name, &bytes)
	if err != nil {
		roomError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": name}))
	w.Write(bytes)
}

func (h *Handler) TaskFromMessage(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	msg, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "message")
	if !ok {
		return
	}
	var body struct {
		Title, Description string
		RequestID          string `json:"request_id"`
	}
	if !decodePlan(w, r, &body) {
		return
	}
	key, ok := parseUUIDOrBadRequest(w, body.RequestID, "request_id")
	if !ok {
		return
	}
	body.Title = strings.TrimSpace(body.Title)
	if body.Title == "" || len([]rune(body.Title)) > 200 || len(body.Description) > 64000 {
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
	var project pgtype.UUID
	err = tx.QueryRow(ctx, "SELECT r.project_id"+visibleRoom+` AND r.id=(SELECT room_id FROM collaboration_message WHERE id=$3) FOR UPDATE OF r FOR SHARE OF m,p`, m.WorkspaceID, m.UserID, msg).Scan(&project)
	if err != nil {
		roomError(w, err)
		return
	}
	var issue string
	err = tx.QueryRow(ctx, `SELECT issue_id FROM issue_message_source WHERE message_id=$1 AND ((creator_id=$2 AND request_id=$3) OR normalized_title=lower(trim($4))) ORDER BY issue_id LIMIT 1`, msg, m.UserID, key, body.Title).Scan(&issue)
	if err == nil {
		writeJSON(w, 200, map[string]string{"id": issue})
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		roomError(w, err)
		return
	}
	result, err := h.IssueService.CreateInTransaction(ctx, tx, service.IssueCreateParams{WorkspaceID: m.WorkspaceID, ProjectID: project, CreatorType: "member", CreatorID: m.UserID, Title: body.Title, Description: pgtype.Text{String: body.Description, Valid: true}, Status: "backlog", Priority: "none", AllowDuplicate: true})
	if err != nil {
		roomError(w, err)
		return
	}
	_, err = tx.Exec(ctx, `INSERT INTO issue_message_source(issue_id,message_id,creator_id,request_id,normalized_title) VALUES($1,$2,$3,$4,lower(trim($5)))`, result.Issue.ID, msg, m.UserID, key, body.Title)
	if err == nil {
		err = tx.Commit(ctx)
	}
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 201, map[string]string{"id": uuidToString(result.Issue.ID)})
}

func (h *Handler) IssueSource(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	id, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "issue")
	if !ok {
		return
	}
	if _, ok := h.loadIssueForUser(w, r, uuidToString(id)); !ok {
		return
	}
	var data json.RawMessage
	err := h.DB.QueryRow(r.Context(), `SELECT coalesce((SELECT jsonb_build_object('id',r.id,'title',r.title,'message_id',s.message_id) FROM issue_message_source s
        JOIN collaboration_message msg ON msg.id=s.message_id JOIN collaboration_room r ON r.id=msg.room_id
        JOIN collaboration_participant p ON p.room_id=r.id AND p.member_id=$3
        WHERE r.workspace_id=i.workspace_id AND s.issue_id=i.id),(SELECT jsonb_build_object('id',c.id,'title',c.title,'kind','work','message_id',msg.id)
 FROM work_message_task s JOIN workbench_message msg ON msg.id=s.message_id JOIN workbench_conversation c ON c.id=msg.conversation_id
 WHERE s.issue_id=i.id AND msg.workspace_id=i.workspace_id AND msg.owner_id=$4),'null'::jsonb)
        FROM issue i WHERE i.workspace_id=$1 AND i.id=$2`, m.WorkspaceID, id, m.ID, m.UserID).Scan(&data)
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, map[string]json.RawMessage{"source": data})
}

func (h *Handler) RoomUpdate(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	id, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "room")
	if !ok {
		return
	}
	var req struct {
		NewProject   string `json:"new_project"`
		Title        string
		Members      []string
		AddAgents    []string `json:"add_agents"`
		RemoveAgents []string `json:"remove_agents"`
		Revision     int
		Project      string `json:"project_id"`
	}
	if !decodePlan(w, r, &req) {
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" || len([]rune(req.Title)) > 100 || len(req.Members) > 100 || len(req.AddAgents)+len(req.RemoveAgents) > 100 {
		writeError(w, 422, "请核对会话名称和参与成员")
		return
	}
	ctx := r.Context()
	tx, err := h.TxStarter.Begin(ctx)
	if err != nil {
		roomError(w, err)
		return
	}
	defer tx.Rollback(ctx)
	var revision int
	var kind string
	err = tx.QueryRow(ctx, "SELECT r.revision,r.kind"+visibleRoom+" AND r.id=$3 AND r.owner_id=$2 FOR UPDATE OF r", m.WorkspaceID, m.UserID, id).Scan(&revision, &kind)
	if err != nil {
		roomError(w, err)
		return
	}
	if req.Revision != revision {
		writeError(w, 409, "会话成员或归属已更新")
		return
	}
	var project pgtype.UUID
	if title := strings.TrimSpace(req.NewProject); title != "" {
		if len([]rune(title)) > 100 || req.Project != "" {
			writeError(w, 422, "请核对项目名称或所选项目")
			return
		}
		lookup := func() error {
			return tx.QueryRow(ctx, `SELECT id FROM project WHERE workspace_id=$1 AND trim(title)=$2 ORDER BY created_at LIMIT 1 FOR KEY SHARE`, m.WorkspaceID, title).Scan(&project)
		}
		err = lookup()
		if errors.Is(err, pgx.ErrNoRows) {
			writeTx, e := tx.Begin(ctx)
			if e != nil {
				roomError(w, e)
				return
			}
			err = writeTx.QueryRow(ctx, `INSERT INTO project(workspace_id,title,status,lead_type,lead_id,priority) VALUES($1,$2,'planned','member',$3,'none') RETURNING id`, m.WorkspaceID, title, m.UserID).Scan(&project)
			if err == nil {
				err = writeTx.Commit(ctx)
			} else {
				_ = writeTx.Rollback(ctx)
				err = lookup()
			}
		}
		if err != nil {
			roomError(w, err)
			return
		}
	}
	if req.Project != "" {
		project, ok = parseUUIDOrBadRequest(w, req.Project, "project")
		if !ok {
			return
		}
		if err = tx.QueryRow(ctx, "SELECT id FROM project WHERE workspace_id=$1 AND id=$2 FOR KEY SHARE", m.WorkspaceID, project).Scan(&project); err != nil {
			roomError(w, err)
			return
		}
	}
	if req.Members != nil {
		if kind != "group" {
			writeError(w, 422, "私聊不能更换参与者")
			return
		}
		ids := map[pgtype.UUID]bool{m.UserID: true}
		for _, s := range req.Members {
			u, ok := parseUUIDOrBadRequest(w, s, "member")
			if !ok {
				return
			}
			ids[u] = true
		}
		if len(ids) < 2 {
			writeError(w, 422, "请至少保留另一位成员")
			return
		}
		keep := make([]pgtype.UUID, 0, len(ids))
		for uid := range ids {
			keep = append(keep, uid)
		}
		if _, err = tx.Exec(ctx, `DELETE FROM collaboration_participant p USING member m WHERE p.room_id=$1 AND m.id=p.member_id AND NOT(m.user_id=ANY($2::uuid[]))`, id, keep); err != nil {
			roomError(w, err)
			return
		}
		for uid := range ids {
			if uid == m.UserID {
				continue
			}
			tag, e := tx.Exec(ctx, "INSERT INTO collaboration_participant SELECT $1,id FROM member WHERE workspace_id=$2 AND user_id=$3 ON CONFLICT(room_id,member_id) DO UPDATE SET member_id=EXCLUDED.member_id", id, m.WorkspaceID, uid)
			if e != nil || tag.RowsAffected() != 1 {
				writeError(w, 422, "参与成员不可用")
				return
			}
		}
	}
	if len(req.AddAgents)+len(req.RemoveAgents) > 0 {
		if kind != "group" {
			writeError(w, 422, "只能在群聊中调整智能体成员")
			return
		}
		for _, raw := range req.RemoveAgents {
			agent, ok := parseUUIDOrBadRequest(w, raw, "agent_id")
			if !ok {
				return
			}
			if _, err = tx.Exec(ctx, "DELETE FROM collaboration_room_agent WHERE room_id=$1 AND agent_id=$2", id, agent); err != nil {
				roomError(w, err)
				return
			}
		}
		for _, raw := range req.AddAgents {
			agent, ok := parseUUIDOrBadRequest(w, raw, "agent_id")
			if !ok {
				return
			}
			// Hold the agent row until the room edit commits, including concurrent archival.
			var locked pgtype.UUID
			err = tx.QueryRow(ctx, `SELECT id FROM agent WHERE id=$1 AND workspace_id=$2 AND archived_at IS NULL FOR SHARE`, agent, m.WorkspaceID).Scan(&locked)
			if err != nil {
				roomError(w, err)
				return
			}
			if _, err = h.authorizedRoomAgent(ctx, tx, m, id, locked, nil); err != nil {
				roomError(w, err)
				return
			}
			if _, err = tx.Exec(ctx, "INSERT INTO collaboration_room_agent(room_id,agent_id) VALUES($1,$2) ON CONFLICT DO NOTHING", id, agent); err != nil {
				roomError(w, err)
				return
			}
		}
	}
	_, err = tx.Exec(ctx, "UPDATE collaboration_room SET title=$2,project_id=$3,revision=revision+1 WHERE id=$1", id, req.Title, project)
	if err == nil {
		err = tx.Commit(ctx)
	}
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"id": uuidToString(id), "revision": revision + 1, "title": req.Title, "project_id": project})
}

func (h *Handler) ReadRoom(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	id, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "room")
	if !ok {
		return
	}
	var body struct {
		Last string `json:"last"`
	}
	if !decodePlan(w, r, &body) {
		return
	}
	last, ok := parseUUIDOrBadRequest(w, body.Last, "last")
	if !ok {
		return
	}
	tag, err := h.DB.Exec(r.Context(), `UPDATE inbox_item n SET read=true FROM collaboration_message last,collaboration_message msg
        WHERE last.id=$4 AND last.room_id=$3 AND msg.room_id=$3 AND (msg.created_at,msg.id)<=(last.created_at,last.id)
        AND n.type='room_message' AND n.workspace_id=$1 AND n.recipient_id=$2 AND NOT n.read AND n.details->>'message_id'=msg.id::text
        AND n.details->>'room_id'=$3::uuid::text AND EXISTS(SELECT r.id`+visibleRoom+` AND r.id=$3)`, m.WorkspaceID, m.UserID, id, last)
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, map[string]int64{"count": tag.RowsAffected()})
}
