DROP TRIGGER project_title_claim_changed ON project;
DROP FUNCTION maintain_project_title();
DROP TABLE project_title_claim;
DROP INDEX project_start_recipient_version;
ALTER TABLE project_start_request DROP COLUMN version;
