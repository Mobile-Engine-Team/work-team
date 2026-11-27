CREATE FUNCTION deliver_collaboration_message() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO inbox_item(workspace_id,recipient_type,recipient_id,type,title,details)
    SELECT r.workspace_id,'member',m.user_id,'room_message','收到新会话消息',
      jsonb_build_object('room_id',r.id,'message_id',NEW.id,'participant_id',m.id)
    FROM collaboration_room r JOIN collaboration_participant p ON p.room_id=r.id JOIN member m ON m.id=p.member_id AND m.workspace_id=r.workspace_id
    WHERE r.id=NEW.room_id AND m.user_id<>NEW.sender_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER collaboration_delivered AFTER INSERT ON collaboration_message FOR EACH ROW EXECUTE FUNCTION deliver_collaboration_message();
CREATE FUNCTION clear_room_notices() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM inbox_item WHERE type='room_message' AND details->>'room_id'=OLD.room_id::text AND details->>'participant_id'=OLD.member_id::text;
  RETURN OLD;
END; $$;
CREATE TRIGGER collaboration_revoke_notice AFTER DELETE ON collaboration_participant FOR EACH ROW EXECUTE FUNCTION clear_room_notices();
CREATE INDEX inbox_room_notice ON inbox_item(workspace_id,recipient_id,(details->>'room_id')) WHERE type='room_message';
