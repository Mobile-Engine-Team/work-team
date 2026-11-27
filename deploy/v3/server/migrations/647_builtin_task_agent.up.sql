-- Give the same workspace-local Work identity to planning, task assignment and queue receipts.
CREATE FUNCTION mobilework_install_agent(w uuid, a uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    display_name text := 'Work';
    suffix integer := 0;
BEGIN
    -- Retain old custom agents named Work and their existing links unchanged.
    WHILE EXISTS (SELECT 1 FROM agent WHERE workspace_id=w AND id<>a AND archived_at IS NULL AND name=display_name) LOOP
        suffix := suffix + 1;
        display_name := CASE WHEN suffix=1 THEN 'Work（内置）' ELSE format('Work（内置 %s）',suffix) END;
    END LOOP;
    INSERT INTO agent_runtime(id,workspace_id,name,runtime_mode,provider,visibility)
      VALUES(a,w,'内置 Work','cloud','mobilework','private') ON CONFLICT(id) DO NOTHING;
    INSERT INTO agent(id,workspace_id,name,description,instructions,runtime_mode,runtime_id,system_key,visibility,permission_mode)
      VALUES(a,w,display_name,'内置智能体','根据可见材料完成工作并提供有依据的交付。','cloud',a,'mobilework','workspace','public_to') ON CONFLICT(id) DO NOTHING;
    INSERT INTO agent_invocation_target(agent_id,target_type,target_id) VALUES(a,'workspace',w) ON CONFLICT DO NOTHING;
END; $$;
SELECT mobilework_install_agent(workspace_id,id) FROM workspace_work;
CREATE FUNCTION mobilework_work_agent_created() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM mobilework_install_agent(NEW.workspace_id,NEW.id); RETURN NEW; END; $$;
CREATE TRIGGER mobilework_work_agent AFTER INSERT ON workspace_work FOR EACH ROW EXECUTE FUNCTION mobilework_work_agent_created();
