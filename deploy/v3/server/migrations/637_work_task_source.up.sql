CREATE TABLE work_message_task (
    message_id uuid PRIMARY KEY REFERENCES workbench_message(id) ON DELETE CASCADE,
    issue_id uuid UNIQUE NOT NULL REFERENCES issue(id) ON DELETE CASCADE
);
ALTER TABLE issue_message_source ADD COLUMN normalized_title text;
UPDATE issue_message_source s SET normalized_title=lower(trim(i.title)) FROM issue i WHERE i.id=s.issue_id;
