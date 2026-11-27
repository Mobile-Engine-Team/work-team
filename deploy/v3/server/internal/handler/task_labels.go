package handler

import (
	"errors"
	"net/http"
	"sort"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/multica-ai/multica/server/internal/service"
)

func (h *Handler) ReplaceTaskLabels(w http.ResponseWriter, r *http.Request) {
	member, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	issue, ok := h.loadIssueForUser(w, r, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	var body struct {
		Names    []string `json:"names"`
		Revision int64    `json:"expected_revision"`
	}
	if !decodePlan(w, r, &body) {
		return
	}
	if body.Names == nil || len(body.Names) > 50 || body.Revision < 1 {
		writeError(w, 400, "请核对标签数量和任务版本")
		return
	}
	for i, input := range body.Names {
		name, err := validateLabelName(input)
		if err != nil {
			writeError(w, 400, err.Error())
			return
		}
		body.Names[i] = name
	}
	sort.SliceStable(body.Names, func(i, j int) bool { return strings.ToLower(body.Names[i]) < strings.ToLower(body.Names[j]) })

	ctx := r.Context()
	tx, err := h.TxStarter.Begin(ctx)
	if err != nil {
		roomError(w, err)
		return
	}
	defer tx.Rollback(ctx)
	var revision int64
	err = tx.QueryRow(ctx, "SELECT revision FROM issue WHERE id=$1 AND workspace_id=$2 FOR UPDATE", issue.ID, member.WorkspaceID).Scan(&revision)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, 404, "任务不可用")
		return
	}
	if err != nil {
		roomError(w, err)
		return
	}
	if revision != body.Revision {
		writeError(w, 409, "任务已更新，请重新读取标签")
		return
	}

	ids, err := service.ResolveIssueLabelNames(ctx, tx, member.WorkspaceID, body.Names)
	if err != nil {
		roomError(w, err)
		return
	}
	dropped, err := tx.Exec(ctx, "DELETE FROM issue_to_label WHERE issue_id=$1 AND NOT (label_id=ANY($2::uuid[]))", issue.ID, ids)
	if err != nil {
		roomError(w, err)
		return
	}
	added, err := tx.Exec(ctx, "INSERT INTO issue_to_label(issue_id,label_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING", issue.ID, ids)
	if err != nil {
		roomError(w, err)
		return
	}
	if dropped.RowsAffected()+added.RowsAffected() > 0 {
		_, err = tx.Exec(ctx, "UPDATE issue SET revision=revision+1, updated_at=now(), last_activity_at=GREATEST(last_activity_at, now()) WHERE id=$1", issue.ID)
		if err != nil {
			roomError(w, err)
			return
		}
	}
	if err = tx.Commit(ctx); err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, map[string]string{"id": uuidToString(issue.ID)})
}
