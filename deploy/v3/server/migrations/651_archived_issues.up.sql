-- Historical imports are kept outside the live issue collection and planning queue.
CREATE TABLE archived_issue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    project_id uuid REFERENCES project(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text NOT NULL,
    status text NOT NULL,
    archived_by uuid REFERENCES "user"(id) ON DELETE SET NULL,
    archived_at timestamptz NOT NULL DEFAULT now()
);
