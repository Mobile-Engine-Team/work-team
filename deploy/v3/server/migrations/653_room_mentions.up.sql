-- Keep the recipient identity with the delivered message even if their name changes.
CREATE FUNCTION tag_collaboration_mention() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM collaboration_message msg
    JOIN collaboration_participant p ON p.room_id=msg.room_id
    JOIN member m ON m.id=p.member_id AND m.workspace_id=NEW.workspace_id AND m.user_id=NEW.recipient_id
    JOIN "user" u ON u.id=m.user_id
    CROSS JOIN LATERAL unnest(ARRAY[u.email,u.name]) AS labels(label)
    CROSS JOIN LATERAL regexp_split_to_table(' '||msg.content,'[[:space:]]@') WITH ORDINALITY AS words(part,idx)
    WHERE msg.id=(NEW.details->>'message_id')::uuid AND words.idx>1 AND label<>'' AND label<>'Work'
      AND starts_with(part,label) AND (length(part)=length(label) OR substring(part FROM length(label)+1 FOR 1) ~ '[[:space:]，。！？、,;:：；!?]')
      AND NOT EXISTS(SELECT 1 FROM collaboration_participant other JOIN member om ON om.id=other.member_id JOIN "user" ou ON ou.id=om.user_id
                     WHERE other.room_id=msg.room_id AND om.user_id<>m.user_id AND label IN (ou.email,ou.name))
  ) THEN
    NEW.details := NEW.details || jsonb_build_object('mentioned',true);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER inbox_room_mention BEFORE INSERT ON inbox_item FOR EACH ROW
WHEN (NEW.type='room_message') EXECUTE FUNCTION tag_collaboration_mention();
