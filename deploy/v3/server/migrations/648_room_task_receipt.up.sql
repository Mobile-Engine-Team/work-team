CREATE TABLE room_task_receipt (
    message_id uuid PRIMARY KEY REFERENCES collaboration_message(id) ON DELETE CASCADE,
    issue_id uuid NOT NULL REFERENCES issue(id) ON DELETE CASCADE
);
