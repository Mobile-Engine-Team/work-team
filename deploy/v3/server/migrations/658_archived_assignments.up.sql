-- Lock the assignment target until the issue write commits. An archive either
-- sees this assignment or finishes first and prevents a new active assignment.
CREATE FUNCTION mw_check_assignment_target() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    active boolean;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF (NEW.assignee_type, NEW.assignee_id) IS NOT DISTINCT FROM (OLD.assignee_type, OLD.assignee_id)
           AND NOT (OLD.status IN ('done','cancelled') AND NEW.status NOT IN ('done','cancelled')) THEN
            RETURN NEW;
        END IF;
    END IF;
    IF NEW.assignee_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.assignee_type = 'agent' THEN
        SELECT archived_at IS NULL INTO active FROM agent
        WHERE workspace_id=NEW.workspace_id AND id=NEW.assignee_id FOR SHARE;
    ELSIF NEW.assignee_type = 'squad' THEN
        SELECT archived_at IS NULL INTO active FROM squad
        WHERE workspace_id=NEW.workspace_id AND id=NEW.assignee_id FOR SHARE;
    ELSE
        RETURN NEW;
    END IF;
    IF active IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'assignment target is unavailable in this workspace'
            USING ERRCODE='23514', CONSTRAINT='mw_active_assignment_target';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER mw_check_issue_assignment BEFORE INSERT OR UPDATE OF assignee_type,assignee_id,status
ON issue FOR EACH ROW EXECUTE FUNCTION mw_check_assignment_target();

-- The issue revision and its audit entry are part of the archive transaction.
CREATE FUNCTION mw_settle_archived_assignments() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    actor_kind text := CASE WHEN NEW.archived_by IS NULL THEN 'system' ELSE 'member' END;
BEGIN
    IF TG_TABLE_NAME = 'agent' THEN
        WITH affected AS (
            SELECT id,status FROM issue WHERE workspace_id=NEW.workspace_id
                AND assignee_type='agent' AND assignee_id=NEW.id
                AND status NOT IN ('done','cancelled') ORDER BY id FOR UPDATE
        ), changed AS (
            UPDATE issue i SET status='cancelled',revision=i.revision+1,updated_at=now()
            FROM affected a WHERE i.id=a.id RETURNING i.id,a.status
        )
        INSERT INTO activity_log(workspace_id,issue_id,actor_type,actor_id,action,details)
        SELECT NEW.workspace_id,id,actor_kind,NEW.archived_by,'status_changed',
            jsonb_build_object('from',status,'to','cancelled','source','agent_archived','agent_id',NEW.id)
        FROM changed;
    ELSE
        WITH changed AS (
            UPDATE issue SET assignee_type='agent',assignee_id=NEW.leader_id,
                revision=revision+1,updated_at=now()
            WHERE workspace_id=NEW.workspace_id AND assignee_type='squad' AND assignee_id=NEW.id
                AND status NOT IN ('done','cancelled') RETURNING id
        )
        INSERT INTO activity_log(workspace_id,issue_id,actor_type,actor_id,action,details)
        SELECT NEW.workspace_id,id,actor_kind,NEW.archived_by,'assignee_changed',
            jsonb_build_object('from_type','squad','from_id',NEW.id,'to_type','agent','to_id',NEW.leader_id,
                               'source','squad_archived')
        FROM changed;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER mw_archive_agent_work AFTER UPDATE OF archived_at ON agent
FOR EACH ROW WHEN (OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL)
EXECUTE FUNCTION mw_settle_archived_assignments();
CREATE TRIGGER mw_archive_squad_work AFTER UPDATE OF archived_at ON squad
FOR EACH ROW WHEN (OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL)
EXECUTE FUNCTION mw_settle_archived_assignments();

-- An execution admitted just before the archive is included in its queue
-- cancellation. Admission after the archive may never start another run.
CREATE FUNCTION mw_check_queue_agent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM 1 FROM agent WHERE id=NEW.agent_id AND archived_at IS NULL FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'execution agent is unavailable in this workspace'
            USING ERRCODE='23514', CONSTRAINT='mw_active_queue_agent';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER mw_guard_queue_agent BEFORE INSERT ON agent_task_queue
FOR EACH ROW WHEN (NEW.status IN ('queued','dispatched','running','waiting_local_directory','deferred'))
EXECUTE FUNCTION mw_check_queue_agent();
