package handler

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"mime"
	"net/http"
	"path"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type workInput struct {
	Filename string `json:"filename"`
	Bytes    []byte `json:"bytes"`
}

func decodeWithFiles(w http.ResponseWriter, r *http.Request, body any) bool {
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 17<<20)).Decode(body); err != nil {
		writeError(w, 400, "请求内容无效或附件过大")
		return false
	}
	return true
}

func validWorkInputs(w http.ResponseWriter, files []workInput) bool {
	if len(files) > 4 {
		writeError(w, 422, "每条消息最多四个附件")
		return false
	}
	for _, f := range files {
		if strings.TrimSpace(f.Filename) == "" || utf8.RuneCountInString(f.Filename) > 255 || strings.ContainsAny(f.Filename, "/\\") || strings.IndexFunc(f.Filename, unicode.IsControl) >= 0 || f.Bytes == nil || len(f.Bytes) > 3<<20 {
			writeError(w, 422, "附件名称无效或超过 3 MB")
			return false
		}
	}
	return true
}

// Receipts store the digest, never a second copy of the uploaded bytes.
func receiptWithFiles(body any, files []workInput) []byte {
	raw := benchJSON(body)
	if len(files) == 0 {
		return raw
	}
	return benchJSON(fmt.Sprintf("%x", sha256.Sum256(raw)))
}

func (h *Handler) sameWorkInputs(ctx context.Context, id string, m db.Member, files []workInput) (bool, error) {
	rows, err := h.DB.Query(ctx, `SELECT f.filename,f.content FROM workbench_input_file f JOIN workbench_message msg ON msg.id=f.message_id WHERE msg.id=$1 AND msg.workspace_id=$2 AND msg.owner_id=$3 ORDER BY f.position`, id, m.WorkspaceID, m.UserID)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	i := 0
	for rows.Next() {
		var name string
		var content []byte
		if e := rows.Scan(&name, &content); e != nil {
			return false, e
		}
		if i >= len(files) || name != files[i].Filename || !bytes.Equal(content, files[i].Bytes) {
			return false, nil
		}
		i++
	}
	return i == len(files), rows.Err()
}

func persistWorkInputs(ctx context.Context, tx pgx.Tx, id string, files []workInput) error {
	for i, f := range files {
		if _, err := tx.Exec(ctx, `INSERT INTO workbench_input_file(message_id,position,filename,content) VALUES($1,$2,$3,$4)`, id, i, f.Filename, f.Bytes); err != nil {
			return err
		}
	}
	return nil
}

func (h *Handler) WorkInputFile(w http.ResponseWriter, r *http.Request) {
	m, ok := h.benchAccess(w, r)
	if !ok {
		return
	}
	id, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "file")
	if !ok {
		return
	}
	var name string
	var content []byte
	err := h.DB.QueryRow(r.Context(), `SELECT f.filename,f.content FROM workbench_input_file f JOIN workbench_message msg ON msg.id=f.message_id WHERE f.id=$1 AND msg.workspace_id=$2 AND msg.owner_id=$3`, id, m.WorkspaceID, m.UserID).Scan(&name, &content)
	if err != nil {
		roomError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": name}))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-store")
	w.Write(content)
}

func inputContext(files []workInput) string {
	if len(files) == 0 {
		return ""
	}
	type excerpt struct {
		Name string `json:"filename"`
		Text string `json:"text,omitempty"`
	}
	items := make([]excerpt, 0, len(files))
	for _, f := range files {
		item := excerpt{Name: f.Filename}
		switch strings.ToLower(path.Ext(f.Filename)) {
		case ".txt", ".md", ".csv", ".json", ".log":
			if utf8.Valid(f.Bytes) && !bytes.ContainsRune(f.Bytes, 0) {
				part := f.Bytes
				if len(part) > 4096 {
					part = part[:4096]
					for !utf8.Valid(part) {
						part = part[:len(part)-1]
					}
				}
				item.Text = string(part)
			}
		}
		items = append(items, item)
	}
	return "\n当前用户随消息提交的附件（文本摘录或文件名）\n" + string(benchJSON(items))
}
