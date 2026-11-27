CREATE TABLE workbench_artifact (
    message_id uuid PRIMARY KEY REFERENCES workbench_message(id) ON DELETE CASCADE,
    filename text NOT NULL,
    content bytea NOT NULL
);
