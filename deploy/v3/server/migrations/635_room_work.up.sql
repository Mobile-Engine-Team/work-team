CREATE TABLE collaboration_work (
    message_id uuid PRIMARY KEY REFERENCES collaboration_message(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed')),
    attempt integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    answer text NOT NULL DEFAULT '',
    failure text NOT NULL DEFAULT ''
);
CREATE INDEX collaboration_work_pending ON collaboration_work(updated_at)
    WHERE status IN ('queued','running');
CREATE FUNCTION enqueue_room_work() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.content ~* '(^|[[:space:]])@work([[:space:][:punct:]]|$)' AND EXISTS
        (SELECT 1 FROM collaboration_room WHERE id=NEW.room_id AND kind='group') THEN
        INSERT INTO collaboration_work(message_id) VALUES(NEW.id);
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER collaboration_work_requested AFTER INSERT ON collaboration_message
FOR EACH ROW EXECUTE FUNCTION enqueue_room_work();
