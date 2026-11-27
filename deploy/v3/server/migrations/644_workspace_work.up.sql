CREATE TABLE workspace_work (
    workspace_id uuid PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
    id uuid UNIQUE NOT NULL DEFAULT gen_random_uuid()
);
-- A V3 rollback preserves task references to the built-in agent.
INSERT INTO workspace_work(workspace_id,id)
SELECT w.id,coalesce((SELECT a.id FROM agent a WHERE a.workspace_id=w.id AND a.system_key='mobilework'
                     ORDER BY a.created_at,a.id LIMIT 1),gen_random_uuid()) FROM workspace w;
CREATE FUNCTION provision_workspace_work() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO workspace_work(workspace_id) VALUES(NEW.id); RETURN NEW; END; $$;
CREATE TRIGGER workspace_work_created AFTER INSERT ON workspace FOR EACH ROW EXECUTE FUNCTION provision_workspace_work();
