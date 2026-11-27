package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/multica-ai/multica/server/internal/workbench"
)

// The directory and workbench report the same adapter readiness without starting a model run.
func (h *Handler) workRuntimeStatus() string {
	if mockWork() {
		return "ready"
	}
	return h.WorkbenchPi.Status()
}

func (h *Handler) WorkModelReadiness(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.benchAccess(w, r); !ok {
		return
	}
	status := h.workRuntimeStatus()
	writeJSON(w, http.StatusOK, map[string]any{"runtimeStatus": status, "modelReady": status == "ready"})
}

func (h *Handler) readyWorkModel(w http.ResponseWriter) (string, bool) {
	if mockWork() {
		return "explicit-mock", true
	}
	if !h.WorkbenchPi.Enabled() {
		writeError(w, 503, "Work 尚未配置模型服务")
		return "", false
	}
	model, err := h.WorkbenchPi.Select("")
	if err != nil {
		writeError(w, 503, err.Error())
		return "", false
	}
	if err = h.WorkbenchPi.RequireReady(); err != nil {
		w.Header().Set("Retry-After", "5")
		writeError(w, 503, err.Error())
		return "", false
	}
	return model, true
}

// The explicit model adapter queries the same permission-checked workspace corpus as Pi.
func mockWorkbench(c workbench.Corpus, prompt string, base *workbench.Result) (workbench.Result, error) {
	if strings.Contains(prompt, "【模拟失败】") {
		return workbench.Result{}, errors.New("Mock 运行失败")
	}
	q := workbench.Query{Source: "issue", Limit: 40}
	if base != nil && base.Action == "" && len(base.View.Queries) > 0 && base.View.Queries[0].Source == "issue" {
		q = base.View.Queries[0]
	}
	projectTitle := ""
	for _, e := range c.Records {
		if e.Kind == "project" && len(e.Title) > len(projectTitle) && strings.Contains(prompt, e.Title) {
			projectTitle = e.Title
			q = workbench.Query{Source: "issue", Limit: 40, ProjectID: e.ObjectID}
		}
	}
	if strings.Contains(prompt, "未完成") {
		q.Status = "unfinished"
	} else if strings.Contains(prompt, "已完成") {
		q.Status = "done"
	}
	page, err := c.Search(q)
	if err != nil {
		return workbench.Result{}, err
	}
	items := []workbench.Item{}
	for _, e := range page.Records {
		items = append(items, workbench.Item{Title: e.Title, Value: e.Status, EvidenceIDs: []string{e.ID}})
	}
	view := workbench.View{SchemaVersion: 1, Title: "Work 工作记录", Intent: prompt, Queries: []workbench.Query{q}, Blocks: []workbench.Block{{Type: "list", Title: fmt.Sprintf("当前条件匹配 %d 项任务", page.Total), Items: items, EvidenceIDs: []string{}}}, Limitations: []string{"此回答由显式 Mock 模型适配器生成。"}}
	return workbench.Result{Model: "explicit-mock", RequestedModel: "explicit-mock", Provider: "Mock", Runtime: "Mock", View: view, Evidence: page.Records, Fingerprint: c.ViewFingerprint(view), GeneratedAt: time.Now().UTC().Format(time.RFC3339)}, nil
}
