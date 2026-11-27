package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/multica-ai/multica/server/internal/projectplan"
	"strings"
	"time"
)

func (h *Handler) RunWorkPlanner(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			var id, actor, ws, claim string
			var raw []byte
			err := h.DB.QueryRow(ctx, `WITH candidate AS (SELECT pr.id FROM project_planning_request pr JOIN workspace_work w ON w.workspace_id=pr.workspace_id AND w.id=pr.agent_id
			WHERE pr.status='queued' ORDER BY pr.created_at FOR UPDATE OF pr SKIP LOCKED LIMIT 1)
			UPDATE project_planning_request p SET status='running',run_id=gen_random_uuid(),lease_expires_at=now()+interval '2 minutes',updated_at=now()
			FROM candidate c WHERE p.id=c.id RETURNING p.id,p.input,p.created_by,p.workspace_id,p.run_id`).Scan(&id, &raw, &actor, &ws, &claim)
			if err != nil {
				continue
			}
			var result any
			var input planningInput
			err = json.Unmarshal(raw, &input)
			m, access := h.getWorkspaceMember(ctx, actor, ws)
			if access != nil || m.Role == "guest" {
				err = errors.New("规划请求的成员权限已失效")
			}
			if err == nil {
				if input.Purpose == "task_draft" {
					result, err = h.builtinTaskDraft(ctx, input)
				} else {
					result, err = h.workPlan(ctx, input)
				}
			}
			status, reason := "succeeded", ""
			if err != nil {
				status, reason = "failed", err.Error()
			}
			_, _ = h.DB.Exec(ctx, `UPDATE project_planning_request p SET status=CASE WHEN permitted.ok THEN $2 ELSE 'failed' END,
		result=CASE WHEN permitted.ok THEN $3::jsonb ELSE NULL END,error=CASE WHEN permitted.ok THEN $4 ELSE '成员权限已失效' END,updated_at=now()
		FROM (SELECT EXISTS(SELECT 1 FROM member WHERE workspace_id=$5 AND user_id=$6 AND role<>'guest') ok) permitted WHERE id=$1 AND status='running' AND run_id=$7`, id, status, benchJSON(result), reason, ws, actor, claim)
		}
	}
}
func (h *Handler) workPlan(ctx context.Context, input planningInput) (projectplan.Suggestion, error) {
	var raw []byte
	if mockWork() {
		change := projectplan.Change{ID: "clarify-delivery", Kind: "add", Reason: "Mock · 增加可核对的验收步骤", Node: &projectplan.Node{ID: "new-review", Contract: projectplan.Contract{Title: "复核交付与验收证据", Requirements: "逐项记录复现条件、结果与交付证据。"}, Position: projectplan.Position{X: 360, Y: 180}}}
		if input.Scope == "selected" {
			for i, n := range input.Graph.Nodes {
				if len(input.SelectedNodes) > 0 && n.ID == input.SelectedNodes[0] {
					change.Kind = "update"
					change.Target = fmt.Sprintf("n%d", i+1)
					n.Requirements += "\n逐项核对验收记录。"
					change.Node = &n
					break
				}
			}
		}
		raw = benchJSON(projectplan.Suggestion{SchemaVersion: 1, Changes: []projectplan.Change{change}, Questions: []string{}})
	} else {
		nodes := []map[string]string{}
		for i, n := range input.Graph.Nodes {
			nodes = append(nodes, map[string]string{"id": fmt.Sprintf("n%d", i+1), "title": n.Title, "requirements": n.Requirements})
		}
		answer, err := h.workText(ctx, `根据目标生成蓝图建议，只输出 JSON，格式 {"schema_version":1,"changes":[{"id":"c1","kind":"add","reason":"说明","node":{"id":"new1","title":"任务","requirements":"交付要求","position":{"x":360,"y":180}}}],"questions":[]}。新增 ID 以 new 开头，更新需提供 target 节点别名，禁止设置实际任务 ID 或负责人 ID。`, string(benchJSON(map[string]any{"goal": input.Goal, "scope": input.Scope, "nodes": nodes, "materials": input.Materials})), input.Instructions)
		if err != nil {
			return projectplan.Suggestion{}, err
		}
		raw = []byte(strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(strings.TrimSpace(answer), "```json"), "```")))
	}
	result, err := projectplan.ValidateSuggestion(raw, input.Graph, input.SelectedNodes)
	if err == nil && input.Scope == "add" {
		for _, c := range result.Changes {
			if c.Kind != "add" && c.Kind != "add_edge" {
				return result, errors.New("建议超出新增范围")
			}
		}
	}
	return result, err
}

func (h *Handler) builtinTaskDraft(ctx context.Context, input planningInput) (taskDraftResult, error) {
	var result taskDraftResult
	if mockWork() {
		prompt := strings.TrimSpace(input.Instructions)
		if strings.Contains(prompt, "【模拟失败】") {
			return result, errors.New("Mock 任务起草失败")
		}
		title := []rune(strings.SplitN(prompt, "\n", 2)[0])
		if len(title) > 64 {
			title = title[:64]
		}
		result = taskDraftResult{Title: string(title), Description: "【Mock】" + prompt, Questions: []string{}}
	} else {
		spec := taskDraftContext{Instructions: input.Instructions, Goal: input.Goal, TopicTitle: input.TopicTitle, Conclusion: input.Conclusion, ConclusionRevision: input.ConclusionRevision, ReferenceDate: input.ReferenceDate, Timezone: input.Timezone}
		answer, err := h.workText(ctx, "你是内置 Work，按任务草稿协议返回 JSON。", "", taskDraftPrompt(spec))
		if err != nil {
			return result, err
		}
		if err = json.Unmarshal([]byte(strings.TrimSpace(answer)), &result); err != nil {
			return result, errors.New("任务草稿格式无效")
		}
	}
	if !validTaskDraft(result) {
		return result, errors.New("请补充任务描述后重试")
	}
	return result, nil
}
