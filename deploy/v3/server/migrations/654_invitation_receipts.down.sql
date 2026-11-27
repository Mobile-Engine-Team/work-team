DROP TRIGGER invitation_status_inbox ON workspace_invitation;
DROP TRIGGER personal_invitation_inbox ON workspace;
DROP FUNCTION deliver_invitation_status();
DROP FUNCTION deliver_personal_invitations();
DROP FUNCTION deliver_pending_invitation(uuid,uuid);
DROP INDEX inbox_invitation_receipt;
