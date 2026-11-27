CREATE TABLE room_creation_receipt (
    member_id uuid NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    request_id uuid NOT NULL,
    room_id uuid NOT NULL REFERENCES collaboration_room(id) ON DELETE CASCADE,
    input jsonb NOT NULL,
    PRIMARY KEY(member_id,request_id)
);
