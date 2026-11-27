DROP TRIGGER mw_guard_queue_agent ON agent_task_queue;
DROP FUNCTION mw_check_queue_agent();
DROP TRIGGER mw_archive_squad_work ON squad;
DROP TRIGGER mw_archive_agent_work ON agent;
DROP FUNCTION mw_settle_archived_assignments();
DROP TRIGGER mw_check_issue_assignment ON issue;
DROP FUNCTION mw_check_assignment_target();
