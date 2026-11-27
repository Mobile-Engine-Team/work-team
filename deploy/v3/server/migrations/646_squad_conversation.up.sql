ALTER TABLE collaboration_room ADD COLUMN squad_id uuid REFERENCES squad(id) ON DELETE SET NULL;
CREATE TABLE room_agent_turn (
    message_id uuid PRIMARY KEY REFERENCES collaboration_message(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES agent(id),
    session_id uuid REFERENCES chat_session(id) ON DELETE SET NULL,
    task_id uuid REFERENCES agent_task_queue(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'pending',
    error text NOT NULL DEFAULT '',
    attempt integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX room_agent_turn_pending ON room_agent_turn(updated_at) WHERE status IN('pending','dispatching');
