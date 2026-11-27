DROP INDEX inbox_room_notice;
DROP TRIGGER collaboration_revoke_notice ON collaboration_participant;
DROP FUNCTION clear_room_notices();
DROP TRIGGER collaboration_delivered ON collaboration_message;
DROP FUNCTION deliver_collaboration_message();
