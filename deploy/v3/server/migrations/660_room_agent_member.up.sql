CREATE TABLE collaboration_room_agent (
    room_id uuid NOT NULL REFERENCES collaboration_room(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    PRIMARY KEY (room_id, agent_id)
);
CREATE INDEX collaboration_room_agent_identity ON collaboration_room_agent(agent_id);
