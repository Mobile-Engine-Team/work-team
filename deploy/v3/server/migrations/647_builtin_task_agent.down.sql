DROP TRIGGER mobilework_work_agent ON workspace_work;
DROP FUNCTION mobilework_work_agent_created();
-- Preserve historical agent IDs, associated issues and runtime receipts on rollback.
DROP FUNCTION mobilework_install_agent(uuid,uuid);
