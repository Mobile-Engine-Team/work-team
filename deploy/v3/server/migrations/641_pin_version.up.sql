CREATE TABLE work_pin_version (
    pin_id uuid NOT NULL REFERENCES saved_view(id) ON DELETE CASCADE,
    revision integer NOT NULL,
    result jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(pin_id,revision)
);
INSERT INTO work_pin_version SELECT id,revision,result,updated_at FROM saved_view WHERE result IS NOT NULL;
CREATE FUNCTION capture_work_pin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO work_pin_version(pin_id,revision,result) VALUES(NEW.id,NEW.revision,NEW.result)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END; $$;
CREATE TRIGGER work_pin_changed AFTER INSERT OR UPDATE OF revision ON saved_view
FOR EACH ROW WHEN (NEW.result IS NOT NULL) EXECUTE FUNCTION capture_work_pin();
