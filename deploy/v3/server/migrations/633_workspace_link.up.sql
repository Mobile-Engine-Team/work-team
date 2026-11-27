CREATE TABLE workspace_join_link (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    issuer_id uuid NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workspace_join_link_team ON workspace_join_link(workspace_id,created_at);
