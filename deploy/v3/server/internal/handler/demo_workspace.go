package handler

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/projectplan"
	"github.com/multica-ai/multica/server/internal/service"
)

// seedDemoWorkspace shares the workspace creation transaction. Sample participants
// have workspace-specific synthetic emails and no credentials or linked personal data.
func (h *Handler) seedDemoWorkspace(ctx context.Context, tx pgx.Tx, ws, owner pgtype.UUID) error {
	uuidRow := func(sql string, args ...any) (pgtype.UUID, error) {
		var id pgtype.UUID
		err := tx.QueryRow(ctx, sql, args...).Scan(&id)
		return id, err
	}
	// The walkthrough uses ANDR-101 through ANDR-111. Allocate those display
	// numbers with the same workspace counter used by subsequent user tasks.
	if _, err := tx.Exec(ctx, "UPDATE workspace SET issue_prefix='ANDR',issue_counter=100 WHERE id=$1", ws); err != nil {
		return err
	}
	var users []pgtype.UUID
	for _, name := range []string{"杨陈皓", "林知夏"} {
		user, err := uuidRow(`INSERT INTO "user"(name,email) VALUES($1,gen_random_uuid()::text||'@demo.invalid') RETURNING id`, name)
		if err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO member(workspace_id,user_id,role) VALUES($1,$2,'member')`, ws, user); err != nil {
			return err
		}
		users = append(users, user)
	}
	var agents []pgtype.UUID
	for i, name := range []string{"交付整理助手", "质量验收助手", "个人速记助手", "已归档助手"} {
		mode := "public_to"
		if i == 2 {
			mode = "private"
		}
		id, err := uuidRow(`INSERT INTO agent(workspace_id,owner_id,name,runtime_mode,description,instructions,permission_mode,archived_at)
            VALUES($1,$2,$3,'local','本地样例：整理交付要求与验收结果。','根据当前讨论整理交付清单。',$4,CASE WHEN $5 THEN now() END) RETURNING id`, ws, owner, name, mode, i == 3)
		if err != nil {
			return err
		}
		if mode == "public_to" {
			if _, err = tx.Exec(ctx, `INSERT INTO agent_invocation_target(agent_id,target_type,target_id,created_by) VALUES($1,'workspace',$2,$3)`, id, ws, owner); err != nil {
				return err
			}
		}
		agents = append(agents, id)
	}
	squad, err := uuidRow(`INSERT INTO squad(workspace_id,name,description,leader_id,creator_id) VALUES($1,'移动端交付小队','复现弱网上传问题，交付修复与回归报告。',$2,$3) RETURNING id`, ws, agents[0], owner)
	if err != nil {
		return err
	}
	for i, member := range []pgtype.UUID{agents[0], users[0], users[1]} {
		kind := "member"
		if i == 0 {
			kind = "agent"
		}
		if _, err = tx.Exec(ctx, `INSERT INTO squad_member(squad_id,member_type,member_id) VALUES($1,$2,$3)`, squad, kind, member); err != nil {
			return err
		}
	}
	var projects []pgtype.UUID
	for i, p := range [][2]string{{"移动端弱网上传", "断网恢复后，相同请求不得重复创建上传记录。"}, {"新版发布准备", "组装发布清单后再发布首版施工蓝图。"}, {"体验调研", "空项目，用于检查没有任务或施工蓝图时的界面。"}} {
		lead := owner
		status := "planned"
		if i == 0 {
			status = "in_progress"
		}
		if i == 1 {
			lead = users[1]
		}
		id, err := uuidRow(`INSERT INTO project(workspace_id,title,description,status,lead_type,lead_id,priority,start_date,due_date) VALUES($1,$2,$3,$4,'member',$5,'high',current_date-5,current_date+7) RETURNING id`, ws, p[0], p[1], status, lead)
		if err != nil {
			return err
		}
		projects = append(projects, id)
	}
	graph := projectplan.Empty()
	var issues []pgtype.UUID
	specs := []struct {
		title, status string
		who           pgtype.UUID
	}{
		{"确定弱网复现条件", "done", users[0]}, {"实现上传重试去重", "todo", users[0]}, {"验证重复上传回归", "backlog", users[1]},
		{"整理交付清单", "todo", agents[0]}, {"排查旧版迁移异常", "blocked", owner}, {"补录尚未分配的验证项", "backlog", pgtype.UUID{}},
		{"收集上传日志", "in_progress", owner}, {"核对旧版埋点", "cancelled", users[1]}, {"整理灰度发布材料", "in_progress", owner}, {"评审本周我负责的临时事项", "todo", owner},
	}
	defaultDescription := "验收要求：保留复现步骤、实际结果及交付证据。"
	var releaseNode projectplan.Node
	for i, s := range specs {
		desc := defaultDescription
		if i == 0 {
			desc = "断网后恢复连接，重试同一次上传并记录请求标识。"
		}
		project := projects[0]
		if i == 8 {
			project = projects[1]
		}
		if i == 9 {
			// The historical entry occupied ANDR-110 before it left the live task list.
			if _, err := tx.Exec(ctx, `WITH reserved AS (
				UPDATE workspace SET issue_counter=issue_counter+1 WHERE id=$1 RETURNING id
			) INSERT INTO archived_issue(workspace_id,project_id,title,description,status,archived_by)
			SELECT id,$2,'已归档的旧排查记录',$3,'done',$4 FROM reserved`, ws, projects[0], defaultDescription, owner); err != nil {
				return err
			}
			project = pgtype.UUID{}
		}
		kind := "member"
		if i == 3 {
			kind = "agent"
		}
		if !s.who.Valid {
			kind = ""
		}
		var parent pgtype.UUID
		if i == 6 {
			parent = issues[1]
		}
		// Importing an example never dispatches the example agent.
		result, err := h.IssueService.CreateInTransaction(ctx, tx, service.IssueCreateParams{WorkspaceID: ws, ProjectID: project, ParentIssueID: parent, Title: s.title, Description: pgtype.Text{String: desc, Valid: true}, CreatorType: "member", CreatorID: users[0], Status: "backlog", Priority: "medium", AllowDuplicate: true})
		if err != nil {
			return err
		}
		issue := result.Issue
		issues = append(issues, issue.ID)
		var due string
		offsets := map[int]int{1: 2, 2: 4, 4: -2, 8: 3}
		offset, dated := offsets[i]
		priority := map[int]string{1: "high", 4: "urgent", 9: "low"}[i]
		if priority == "" {
			priority = "medium"
		}
		err = tx.QueryRow(ctx, `UPDATE issue SET status=$2,assignee_type=NULLIF($3,''),assignee_id=$4,priority=$5,position=$8::integer,
        created_at=now()-interval '1 day',updated_at=now()-($8::integer*interval '1 minute'),
        due_date=CASE WHEN $6 THEN current_date+$7::integer END WHERE id=$1 RETURNING coalesce(to_char(due_date,'YYYY-MM-DD'),'')`, issue.ID, s.status, kind, s.who, priority, dated, offset, i).Scan(&due)
		if err != nil {
			return err
		}
		contract := projectplan.Contract{Title: s.title, Requirements: projectplan.Requirements(desc), AssigneeType: kind, DueDate: due}
		if s.who.Valid {
			contract.AssigneeID = uuidToString(s.who)
		}
		id := uuidToString(issue.ID)
		node := projectplan.Node{ID: id, IssueID: id, Contract: contract, Baseline: &projectplan.Baseline{Contract: contract, Description: desc, Status: s.status, ProjectID: uuidToString(project)}}
		if i < 6 {
			xs := []float64{60, 380, 700, 380, 60, 700}
			node.Position = projectplan.Position{X: xs[i], Y: float64(120 + (i/3)*230)}
			graph.Nodes = append(graph.Nodes, node)
		}
		if i == 8 {
			node.Position = projectplan.Position{X: 80, Y: 160}
			releaseNode = node
		}
	}
	// Personal follow-up state belongs to the account creating this sample.
	if _, err := tx.Exec(ctx, `INSERT INTO pinned_item(workspace_id,user_id,item_type,item_id,position)
		VALUES($1,$2,'issue',$3,1)`, ws, owner, issues[4]); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO issue_subscriber(issue_id,user_type,user_id,reason)
		VALUES($1,'member',$3,'manual'),($2,'member',$3,'manual')
		ON CONFLICT(issue_id,user_type,user_id) DO NOTHING`, issues[0], issues[9], owner); err != nil {
		return err
	}
	for _, pair := range [][2]int{{0, 1}, {1, 2}, {0, 3}} {
		from, to := graph.Nodes[pair[0]].ID, graph.Nodes[pair[1]].ID
		graph.Edges = append(graph.Edges, projectplan.Edge{ID: from + ":" + to, From: from, To: to, Handoff: "核对前置交付"})
	}
	raw, err := json.Marshal(graph)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO project_blueprint_version(id,project_id,workspace_id,number,graph,request_id,reason,published_by) VALUES(gen_random_uuid(),$1,$2,1,$3,'seed','确认复现、修复、回归和交接。',$4)`, projects[0], ws, raw, owner); err != nil {
		return err
	}
	draft := projectplan.Empty()
	check := projectplan.Node{ID: "release-check", Contract: projectplan.Contract{Title: "发布前核查", Requirements: "检查版本号、灰度计划和回滚路径。", AssigneeType: "member", AssigneeID: uuidToString(users[1])}, Position: projectplan.Position{X: 410, Y: 160}}
	draft.Nodes = []projectplan.Node{releaseNode, check}
	draft.Edges = []projectplan.Edge{{ID: "release-dependency", From: releaseNode.ID, To: check.ID, Handoff: "灰度发布材料"}}
	raw, err = json.Marshal(draft)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO project_blueprint_draft(project_id,workspace_id,graph,updated_by) VALUES($1,$2,$3,$4)`, projects[1], ws, raw, owner); err != nil {
		return err
	}
	checklist := "# 弱网上传验收清单\n\n- 断网后重连\n- 使用同一请求标识重试\n- 确认只有一条上传记录\n"
	comment, err := uuidRow(`INSERT INTO comment(issue_id,workspace_id,author_type,author_id,content) VALUES($1,$2,'member',$3,'已复现；以下是核对清单。') RETURNING id`, issues[0], ws, users[0])
	if err != nil {
		return err
	}
	file, err := uuidRow(`INSERT INTO attachment(workspace_id,issue_id,comment_id,uploader_type,uploader_id,filename,url,content_type,size_bytes) VALUES($1,$2,$3,'member',$4,'弱网上传验收清单.md','db-content:'||gen_random_uuid()::text,'text/markdown',$5) RETURNING id`, ws, issues[0], comment, users[0], len(checklist))
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "INSERT INTO attachment_content VALUES($1,$2)", file, []byte(checklist)); err != nil {
		return err
	}
	for i, title := range []string{"弱网上传交付协作", "灰度发布私下确认"} {
		kind := "group"
		people := []pgtype.UUID{owner, users[0], users[1]}
		project := projects[0]
		message, filename, content := "已确认复现条件，请核对验收清单。", "弱网上传验收清单.md", checklist
		if i == 0 {
			var ownerName string
			if err := tx.QueryRow(ctx, `SELECT name FROM "user" WHERE id=$1`, owner).Scan(&ownerName); err != nil {
				return err
			}
			message = "@" + ownerName + " " + message
		} else {
			kind = "direct"
			people = people[:2]
			project = pgtype.UUID{}
			message, filename, content = "请私下确认灰度发布的验收时间。", "灰度私聊备忘.txt", "灰度验收时间待确认。"
		}
		room, err := uuidRow(`INSERT INTO collaboration_room(workspace_id,project_id,owner_id,title,kind) VALUES($1,$2,$3,$4,$5) RETURNING id`, ws, project, owner, title, kind)
		if err != nil {
			return err
		}
		if i == 0 {
			if _, err = tx.Exec(ctx, `INSERT INTO collaboration_room_agent(room_id,agent_id)
				SELECT $1,id FROM agent WHERE workspace_id=$2 AND (id=$3 OR system_key='mobilework')`, room, ws, agents[0]); err != nil {
				return err
			}
		}
		for _, who := range people {
			if _, err = tx.Exec(ctx, `INSERT INTO collaboration_participant SELECT $1,id FROM member WHERE workspace_id=$2 AND user_id=$3`, room, ws, who); err != nil {
				return err
			}
		}
		msg, err := uuidRow(`INSERT INTO collaboration_message(room_id,sender_id,request_id,content,filename,file_bytes,created_at) VALUES($1,$2,gen_random_uuid(),$3,$4,$5,now()-interval '2 hour') RETURNING id`, room, users[0], message, filename, []byte(content))
		if err != nil {
			return err
		}
		if i == 0 {
			if _, err = tx.Exec(ctx, `INSERT INTO collaboration_message(room_id,sender_id,request_id,content,created_at)
                VALUES($1,$2,gen_random_uuid(),'断网恢复时，同一请求只能生成一条上传记录。',now()-interval '3 hours')`, room, owner); err != nil {
				return err
			}

			if _, err = tx.Exec(ctx, `INSERT INTO collaboration_message(room_id,sender_id,request_id,content,created_at)
				VALUES($1,$2,gen_random_uuid(),'修复完成后，我会回归慢速连接和多次重试。',now()-interval '1 hour')`, room, users[1]); err != nil {
				return err
			}
			if _, err = tx.Exec(ctx, `INSERT INTO inbox_item(workspace_id,recipient_type,recipient_id,type,issue_id,title,actor_type,actor_id)
				VALUES($1,'member',$2,'issue_updated',$3,'复现条件已更新','member',$4)`, ws, owner, issues[0], users[0]); err != nil {
				return err
			}
			if _, err = tx.Exec(ctx, `INSERT INTO issue_message_source VALUES($1,$2,$3,gen_random_uuid())`, issues[0], msg, owner); err != nil {
				return err
			}
		}
	}
	return nil
}
