CREATE UNIQUE INDEX inbox_invitation_receipt ON inbox_item(workspace_id,recipient_id,type,(details->>'invitation_id'))
  WHERE type IN ('invitation_pending','invitation_accepted','invitation_declined','invitation_revoked');

-- An existing account receives the invitation in its personal workspace before
-- joining the target team. An account registered later gets the same delivery.
CREATE FUNCTION deliver_pending_invitation(inv uuid, personal uuid) RETURNS void LANGUAGE sql AS $$
  INSERT INTO inbox_item(workspace_id,recipient_type,recipient_id,type,title,body,details)
  SELECT p.id,'member',u.id,'invitation_pending','团队邀请',w.name,
    jsonb_build_object('invitation_id',i.id,'invitation_status','pending')
  FROM workspace_invitation i JOIN workspace w ON w.id=i.workspace_id
  JOIN "user" u ON lower(u.email)=i.invitee_email
  JOIN workspace p ON p.personal_owner_id=u.id AND p.kind='personal'
  WHERE i.status='pending' AND i.expires_at>now() AND (inv IS NULL OR i.id=inv) AND (personal IS NULL OR p.id=personal)
  ON CONFLICT DO NOTHING
$$;
CREATE FUNCTION deliver_personal_invitations() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM deliver_pending_invitation(NULL,NEW.id); RETURN NEW; END; $$;
CREATE TRIGGER personal_invitation_inbox AFTER INSERT OR UPDATE OF kind,personal_owner_id ON workspace FOR EACH ROW
WHEN (NEW.kind='personal') EXECUTE FUNCTION deliver_personal_invitations();

CREATE FUNCTION deliver_invitation_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target workspace_invitation%ROWTYPE; outcome text; recipient uuid; note text;
BEGIN
  IF TG_OP='INSERT' THEN PERFORM deliver_pending_invitation(NEW.id,NULL); RETURN NEW; END IF;
  IF TG_OP='DELETE' THEN
    IF OLD.status<>'pending' THEN RETURN OLD; END IF;
    target:=OLD; outcome:='revoked';
  ELSE
    IF OLD.status<>'pending' OR NEW.status=OLD.status THEN RETURN NEW; END IF;
    target:=NEW; outcome:=NEW.status;
  END IF;
  UPDATE inbox_item SET read=true,details=details||jsonb_build_object('invitation_status',outcome)
    WHERE type='invitation_pending' AND details->>'invitation_id'=target.id::text;
  IF outcome NOT IN ('accepted','declined','revoked') THEN RETURN target; END IF;
  note:=CASE outcome WHEN 'accepted' THEN '团队邀请已接受' WHEN 'declined' THEN '团队邀请已拒绝' ELSE '团队邀请已撤销' END;
  INSERT INTO inbox_item(workspace_id,recipient_type,recipient_id,type,title,body,details)
    SELECT target.workspace_id,'member',m.user_id,'invitation_'||outcome,note,target.invitee_email,jsonb_build_object('invitation_id',target.id,'invitation_status',outcome)
    FROM member m JOIN workspace w ON w.id=m.workspace_id WHERE m.workspace_id=target.workspace_id AND m.user_id=target.inviter_id ON CONFLICT DO NOTHING;
  IF outcome='accepted' THEN
    SELECT id INTO recipient FROM "user" WHERE lower(email)=target.invitee_email;
    IF recipient IS NOT NULL THEN
      INSERT INTO inbox_item(workspace_id,recipient_type,recipient_id,type,title,details)
        VALUES(target.workspace_id,'member',recipient,'invitation_accepted','已加入团队',jsonb_build_object('invitation_id',target.id,'invitation_status',outcome))
        ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN target;
END; $$;
CREATE TRIGGER invitation_status_inbox AFTER INSERT OR UPDATE OF status OR DELETE ON workspace_invitation FOR EACH ROW EXECUTE FUNCTION deliver_invitation_status();
SELECT deliver_pending_invitation(NULL,NULL);
