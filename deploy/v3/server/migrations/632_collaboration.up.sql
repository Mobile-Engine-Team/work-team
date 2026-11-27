CREATE TABLE collaboration_room (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    project_id uuid REFERENCES project(id) ON DELETE SET NULL,
    title text NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
    kind text NOT NULL CHECK (kind IN ('direct','group')),
    owner_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE collaboration_participant (
    room_id uuid NOT NULL REFERENCES collaboration_room(id) ON DELETE CASCADE,
    member_id uuid NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    PRIMARY KEY (room_id, member_id)
);
CREATE INDEX collaboration_participant_member ON collaboration_participant(member_id, room_id);
CREATE TABLE collaboration_message (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES collaboration_room(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL,
    request_id uuid NOT NULL,
    content text NOT NULL,
    filename text NOT NULL DEFAULT '',
    file_bytes bytea,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (room_id,sender_id,request_id)
);
CREATE INDEX collaboration_message_order ON collaboration_message(room_id,created_at,id);
CREATE TABLE issue_message_source (
    issue_id uuid PRIMARY KEY REFERENCES issue(id) ON DELETE CASCADE,
    message_id uuid NOT NULL REFERENCES collaboration_message(id) ON DELETE CASCADE,
    creator_id uuid NOT NULL,
    request_id uuid NOT NULL,
    UNIQUE (message_id,creator_id,request_id)
);
