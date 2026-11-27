package handler

import (
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"net/http"
)

func (h *Handler) MemberPreferences(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	var raw json.RawMessage
	var err error
	if r.Method == "GET" {
		err = h.DB.QueryRow(r.Context(), `SELECT coalesce((SELECT to_jsonb(p)-'user_id' FROM mobilework_preference p WHERE user_id=$1),'{"theme":"system","chat_size":15,"instructions":"","memory":"","version":0,"tone":"简洁","loading_hints":true,"generate_memory":false}'::jsonb)`, m.UserID).Scan(&raw)
	} else {
		var p struct {
			Theme, Instructions, Memory string
			Tone                        *string `json:"tone"`
			Hints                       *bool   `json:"loading_hints"`
			GenerateMemory              *bool   `json:"generate_memory"`
			Size                        int     `json:"chat_size"`
			Version                     int
		}
		if !decodePlan(w, r, &p) {
			return
		}
		if p.Tone != nil && *p.Tone != "简洁" && *p.Tone != "严谨" && *p.Tone != "友好" {
			writeError(w, 422, "回复语气无效")
			return
		}
		if (p.Theme != "system" && p.Theme != "dark" && p.Theme != "light") || p.Size < 12 || p.Size > 24 || len([]rune(p.Instructions)) > 150 || len([]rune(p.Memory)) > 2000 || p.Version < 0 {
			writeError(w, 422, "偏好设置值无效")
			return
		}
		err = h.DB.QueryRow(r.Context(), `WITH saved AS(INSERT INTO mobilework_preference AS p (user_id,theme,chat_size,instructions,memory,tone,loading_hints,generate_memory)
		SELECT $1,$2,$3,$4,$5,coalesce($7,'简洁'),coalesce($8,true),coalesce($9,false) WHERE $6::integer=0 OR EXISTS(SELECT 1 FROM mobilework_preference WHERE user_id=$1 AND version=$6)
		ON CONFLICT(user_id) DO UPDATE SET theme=EXCLUDED.theme,chat_size=EXCLUDED.chat_size,instructions=EXCLUDED.instructions,memory=EXCLUDED.memory,tone=coalesce($7,p.tone),loading_hints=coalesce($8,p.loading_hints),generate_memory=coalesce($9,p.generate_memory),version=p.version+1 WHERE p.version=$6 RETURNING *)
		SELECT to_jsonb(saved)-'user_id' FROM saved`, m.UserID, p.Theme, p.Size, p.Instructions, p.Memory, p.Version, p.Tone, p.Hints, p.GenerateMemory).Scan(&raw)
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, 409, "设置已更新，请重新读取")
			return
		}
	}
	if err != nil {
		roomError(w, err)
		return
	}
	writeJSON(w, 200, raw)
}
