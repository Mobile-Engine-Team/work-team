CREATE TABLE work_suggestion (
    workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    member_id uuid NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    issue_id uuid NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
    shown_at timestamptz NOT NULL DEFAULT now(),
    quiet_until timestamptz,
    conversation_id uuid REFERENCES workbench_conversation(id) ON DELETE SET NULL,
    request_id uuid,
    PRIMARY KEY (member_id,issue_id)
);
CREATE INDEX work_suggestion_schedule ON work_suggestion(member_id,shown_at);
