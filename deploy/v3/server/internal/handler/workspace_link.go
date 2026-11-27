package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"github.com/go-chi/chi/v5"
	"github.com/multica-ai/multica/server/internal/auth"
	"net/http"
	"strings"
	"time"
)

type workspaceLink struct {
	ID      string    `json:"id"`
	Token   string    `json:"token"`
	Enabled bool      `json:"enabled"`
	Expires time.Time `json:"expires_at"`
}

func joinProof(id string) string {
	mac := hmac.New(sha256.New, auth.JWTSecret())
	mac.Write([]byte("mobilework/workspace-join/v1/" + id))
	return id + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
func (h *Handler) WorkspaceLinks(w http.ResponseWriter, r *http.Request) {
	m, ok := h.requireWorkspaceRole(w, r, h.resolveWorkspaceID(r), "工作区不可用", "owner", "admin")
	if !ok {
		return
	}
	ctx := r.Context()
	switch r.Method {
	case "GET":
		rows, err := h.DB.Query(ctx, `SELECT id,enabled,expires_at FROM workspace_join_link WHERE workspace_id=$1 ORDER BY created_at DESC`, m.WorkspaceID)
		if err != nil {
			roomError(w, err)
			return
		}
		defer rows.Close()
		out := []workspaceLink{}
		for rows.Next() {
			var link workspaceLink
			if err := rows.Scan(&link.ID, &link.Enabled, &link.Expires); err != nil {
				roomError(w, err)
				return
			}
			link.Token = joinProof(link.ID)
			out = append(out, link)
		}
		if err := rows.Err(); err != nil {
			roomError(w, err)
			return
		}
		writeJSON(w, 200, out)
	case "POST":
		var link workspaceLink
		err := h.DB.QueryRow(ctx, `INSERT INTO workspace_join_link(workspace_id,issuer_id) VALUES($1,$2) RETURNING id,enabled,expires_at`, m.WorkspaceID, m.UserID).Scan(&link.ID, &link.Enabled, &link.Expires)
		if err != nil {
			roomError(w, err)
			return
		}
		link.Token = joinProof(link.ID)
		writeJSON(w, 201, link)
	default:
		id, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "link")
		if !ok {
			return
		}
		var removed string
		var err error
		if r.Method == "DELETE" {
			err = h.DB.QueryRow(ctx, `DELETE FROM workspace_join_link WHERE id=$1 AND workspace_id=$2 RETURNING id`, id, m.WorkspaceID).Scan(&removed)
		} else {
			var body struct{ Enabled *bool }
			if !decodePlan(w, r, &body) {
				return
			}
			if body.Enabled == nil {
				writeError(w, 422, "缺少链接状态")
				return
			}
			err = h.DB.QueryRow(ctx, `UPDATE workspace_join_link SET enabled=$3 WHERE id=$1 AND workspace_id=$2 RETURNING id`, id, m.WorkspaceID, *body.Enabled).Scan(&removed)
		}
		if err != nil {
			roomError(w, err)
			return
		}
		writeJSON(w, 200, map[string]string{"id": removed})
	}
}
func (h *Handler) JoinWorkspaceLink(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}
	var body struct {
		Token  string
		Accept bool
	}
	if !decodePlan(w, r, &body) {
		return
	}
	id, _, ok := strings.Cut(body.Token, ".")
	if !ok || len(id) != 36 || !hmac.Equal([]byte(joinProof(id)), []byte(body.Token)) {
		writeError(w, 404, "邀请不可用")
		return
	}
	ctx := r.Context()
	tx, err := h.TxStarter.Begin(ctx)
	if err != nil {
		roomError(w, err)
		return
	}
	defer tx.Rollback(ctx)
	var ws, slug, name string
	var member bool
	err = tx.QueryRow(ctx, `SELECT w.id,w.slug,w.name,EXISTS(SELECT 1 FROM member WHERE user_id=$2 AND workspace_id=w.id)
        FROM workspace_join_link l JOIN workspace w ON w.id=l.workspace_id WHERE l.id=$1 AND l.enabled AND l.expires_at>now() FOR SHARE OF l,w`, id, uid).Scan(&ws, &slug, &name, &member)
	if err != nil {
		roomError(w, err)
		return
	}
	if body.Accept && !member {
		_, err = tx.Exec(ctx, `INSERT INTO member(user_id,workspace_id,role) VALUES($1,$2,'member') ON CONFLICT(workspace_id,user_id) DO NOTHING`, uid, ws)
		if err != nil {
			roomError(w, err)
			return
		}
		member = true
	}
	if err = tx.Commit(ctx); err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"id": ws, "slug": slug, "name": name, "member": member})
}
