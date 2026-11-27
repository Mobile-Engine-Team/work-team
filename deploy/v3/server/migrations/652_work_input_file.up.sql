CREATE TABLE workbench_input_file (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES workbench_message(id) ON DELETE CASCADE,
  position smallint NOT NULL,
  filename text NOT NULL,
  content bytea NOT NULL,
  UNIQUE(message_id, position)
);
