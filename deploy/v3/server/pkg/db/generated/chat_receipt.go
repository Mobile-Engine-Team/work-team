package db

import (
	"context"
	"github.com/jackc/pgx/v5/pgtype"
)

func (q *Queries) ChatSendReceipt(ctx context.Context, session, key pgtype.UUID, input []byte) ([]byte, bool, error) {
	var raw []byte
	var matches bool
	err := q.db.QueryRow(ctx, "SELECT result,input=$3::jsonb FROM chat_send_receipt WHERE session_id=$1 AND request_id=$2", session, key, input).Scan(&raw, &matches)
	return raw, matches, err
}
func (q *Queries) SaveChatReceipt(ctx context.Context, session, key pgtype.UUID, input, result []byte) error {
	_, err := q.db.Exec(ctx, "INSERT INTO chat_send_receipt VALUES($1,$2,$3,$4)", session, key, input, result)
	return err
}
