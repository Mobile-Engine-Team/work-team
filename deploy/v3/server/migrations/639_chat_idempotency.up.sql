CREATE TABLE chat_send_receipt (
    session_id uuid NOT NULL REFERENCES chat_session(id) ON DELETE CASCADE,
    request_id uuid NOT NULL,
    input jsonb NOT NULL,
    result jsonb NOT NULL,
    PRIMARY KEY(session_id,request_id)
);
