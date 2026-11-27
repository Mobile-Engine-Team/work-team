CREATE TABLE collaboration_extra_file (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES collaboration_message(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 3),
  filename text NOT NULL,
  content bytea NOT NULL,
  UNIQUE(message_id, position)
);
CREATE VIEW collaboration_file AS
  SELECT id, id AS message_id, 0 AS position, filename, file_bytes AS content
  FROM collaboration_message WHERE file_bytes IS NOT NULL
  UNION ALL
  SELECT id, message_id, position, filename, content FROM collaboration_extra_file;
