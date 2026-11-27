package service

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// Keep cancellation of a previous pending run, enqueue and the caller's receipt
// in one transaction. Nested service transactions use savepoints on this tx.
func (s *TaskService) RerunInTransaction(ctx context.Context, tx pgx.Tx, issueID, sourceTaskID, actor pgtype.UUID, allowed func(db.Agent) bool) (*db.AgentTaskQueue, error) {
	scoped := &TaskService{Queries: s.Queries.WithTx(tx), TxStarter: tx, Entitlements: s.Entitlements, Composio: s.Composio, FeatureFlags: s.FeatureFlags, deferProjectEffects: true}
	return scoped.RerunIssue(ctx, issueID, sourceTaskID, pgtype.UUID{}, actor, false, allowed)
}
