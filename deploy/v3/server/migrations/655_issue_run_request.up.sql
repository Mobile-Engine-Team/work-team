CREATE TABLE issue_run_request (
  member_id uuid NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  issue_id uuid NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
  source_task_id uuid,
  receipt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, request_id)
);
