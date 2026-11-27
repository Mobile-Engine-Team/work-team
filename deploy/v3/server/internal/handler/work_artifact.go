package handler

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/multica-ai/multica/server/internal/workbench"
)

func workMarkdown(result workbench.Result) []byte {
	var doc strings.Builder
	fmt.Fprintf(&doc, "# %s\n\n%s\n\n", result.View.Title, result.View.Intent)
	for _, block := range result.View.Blocks {
		fmt.Fprintf(&doc, "## %s\n\n%s\n", block.Title, block.Text)
		for _, item := range block.Items {
			fmt.Fprintf(&doc, "- %s %s %s %s\n", item.Title, item.Text, item.Value, strings.Join(item.Cells, " | "))
		}
	}
	if result.Dynamic != nil {
		keys := make([]string, 0, len(result.Dynamic.Claims))
		for key := range result.Dynamic.Claims {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			fmt.Fprintln(&doc, result.Dynamic.Claims[key].Text)
		}
	}
	for _, limit := range result.View.Limitations {
		fmt.Fprintln(&doc, limit)
	}
	return []byte(doc.String())
}

func (h *Handler) WorkArtifact(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	id, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "message")
	if !ok {
		return
	}
	var body, raw []byte
	err := h.DB.QueryRow(r.Context(), `SELECT a.content,msg.result FROM workbench_artifact a JOIN workbench_message msg ON msg.id=a.message_id
	WHERE msg.workspace_id=$1 AND msg.owner_id=$2 AND msg.id=$3 AND msg.status='completed'`, m.WorkspaceID, m.UserID, id).Scan(&body, &raw)
	if err != nil {
		roomError(w, err)
		return
	}
	c, err := workbench.Load(r.Context(), h.DB, uuidToString(m.WorkspaceID), time.Now())
	if err != nil {
		roomError(w, err)
		return
	}
	result := benchDecodeResult(raw)
	if result == nil || !benchVisible(result, c) {
		writeError(w, 404, "文件不可用")
		return
	}
	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="Work.md"`)
	w.Header().Set("Cache-Control", "no-store")
	w.Write(body)
}
