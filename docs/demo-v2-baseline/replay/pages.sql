-- 用 desktop.py 输出的独立数据库打开 psql，先在 UI 完成“分页复验/分页种子”。
BEGIN;
DO $check$
BEGIN
  IF current_database() !~ '^v2_chat_verify_review_[0-9]{8}_[0-9]{6}_[0-9a-f]{6}$'
     OR (SELECT count(*) FROM workspace w JOIN issue i ON w.id=i.workspace_id
         WHERE w.slug='baseline-pages' AND i.title='分页种子') <> 1 THEN
    RAISE EXCEPTION '需要本轮复验专用库和唯一的分页种子';
  END IF;
END $check$;
INSERT INTO issue(workspace_id,title,status,priority,creator_type,creator_id,number,created_at)
SELECT i.workspace_id,'分页样本-'||lpad(n::text,3,'0'),i.status,i.priority,i.creator_type,i.creator_id,
       i.number+n,now()+n*interval '1 second'
FROM issue i JOIN workspace w ON i.workspace_id=w.id CROSS JOIN generate_series(1,101) n
WHERE w.slug='baseline-pages' AND i.title='分页种子'
  AND NOT EXISTS (SELECT 1 FROM issue present WHERE present.workspace_id=w.id AND present.number=i.number+n);
COMMIT;
