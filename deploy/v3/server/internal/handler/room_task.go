package handler

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/service"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// Lock the source room before selecting an existing task. A committed message,
// linked issue and confirmation card are visible together.
func (h *Handler) createRoomTask(ctx context.Context, tx pgx.Tx, m db.Member, room pgtype.UUID, msg string, request pgtype.UUID, title string) error {
	var project, issue pgtype.UUID
	if err := tx.QueryRow(ctx, "SELECT r.project_id"+visibleRoom+" AND r.id=$3 FOR NO KEY UPDATE OF r FOR SHARE OF m,p", m.WorkspaceID, m.UserID, room).Scan(&project); err != nil {
		return err
	}
	err := tx.QueryRow(ctx, `SELECT s.issue_id FROM issue_message_source s JOIN collaboration_message c ON c.id=s.message_id WHERE c.room_id=$1 AND s.normalized_title=lower(trim($2)) ORDER BY c.created_at LIMIT 1`, room, title).Scan(&issue)
	if errors.Is(err, pgx.ErrNoRows) {
		created, e := h.IssueService.CreateInTransaction(ctx, tx, service.IssueCreateParams{WorkspaceID: m.WorkspaceID, ProjectID: project, CreatorType: "member", CreatorID: m.UserID, Title: title, Status: "backlog", Priority: "none", AllowDuplicate: true})
		if e != nil {
			return e
		}
		issue = created.Issue.ID
		_, err = tx.Exec(ctx, `INSERT INTO issue_message_source(issue_id,message_id,creator_id,request_id,normalized_title) VALUES($1,$2,$3,$4,lower(trim($5)))`, issue, msg, m.UserID, request, title)
	}
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, "INSERT INTO room_task_receipt VALUES($1,$2) ON CONFLICT DO NOTHING", msg, issue)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO collaboration_work(message_id,status,answer) VALUES($1,'completed',$2) ON CONFLICT(message_id) DO UPDATE SET status='completed',answer=EXCLUDED.answer,updated_at=now()`, msg, "已关联任务："+title)
	return err
}
