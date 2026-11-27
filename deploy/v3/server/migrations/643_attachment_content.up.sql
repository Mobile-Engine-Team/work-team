CREATE TABLE attachment_content (
    attachment_id uuid PRIMARY KEY REFERENCES attachment(id) ON DELETE CASCADE,
    content bytea NOT NULL
);
CREATE INDEX IF NOT EXISTS attachment_url_lookup ON attachment(url);
