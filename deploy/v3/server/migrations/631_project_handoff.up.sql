ALTER TABLE project_start_request ADD COLUMN version integer;
-- Earlier receipts did not record a version. Keep their audit trail intact.
CREATE UNIQUE INDEX project_start_recipient_version ON project_start_request
    (project_id, version, issue_id, (result->>'assignee_type'), (result->>'assignee_id'))
    WHERE version IS NOT NULL AND result->>'status' IN ('notified','queued');

-- Grandfather repeated V2 names without renaming projects or breaking stable links.
CREATE TABLE project_title_claim (
    workspace_id uuid NOT NULL,
    title text NOT NULL,
    uses integer NOT NULL,
    PRIMARY KEY (workspace_id, title)
);
LOCK TABLE project IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO project_title_claim SELECT workspace_id, btrim(title), count(*)
FROM project GROUP BY workspace_id, btrim(title);
CREATE FUNCTION maintain_project_title() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF (OLD.workspace_id, btrim(OLD.title)) = (NEW.workspace_id, btrim(NEW.title)) THEN
            RETURN NEW;
        END IF;
    END IF;
    IF TG_OP <> 'INSERT' THEN
        UPDATE project_title_claim SET uses = uses - 1
        WHERE workspace_id = OLD.workspace_id AND title = btrim(OLD.title);
        DELETE FROM project_title_claim
        WHERE workspace_id = OLD.workspace_id AND title = btrim(OLD.title) AND uses = 0;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        INSERT INTO project_title_claim VALUES (NEW.workspace_id, btrim(NEW.title), 1);
        RETURN NEW;
    END IF;
    RETURN OLD;
END;
$$;
CREATE TRIGGER project_title_claim_changed AFTER INSERT OR DELETE OR UPDATE OF workspace_id, title
ON project FOR EACH ROW EXECUTE FUNCTION maintain_project_title();
