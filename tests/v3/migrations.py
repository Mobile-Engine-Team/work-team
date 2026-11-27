"""Rebuild the frozen product schema, then upgrade and roll back only a disposable lab DB."""
import os
from pathlib import Path
import subprocess
import tempfile
from uuid import uuid4

root = Path(__file__).resolve().parents[2]
runtime = Path(os.environ.get("WORKBENCH_RUNTIME", root / ".local/v2-runtime")).resolve()
tools = Path(os.environ.get("MW_V3_PAYLOAD", runtime)).resolve()
pg = Path(os.environ["WORKBENCH_PG_BIN"])
if os.environ.get("WORKBENCH_TEST_LAB") != "1":
    raise SystemExit("需要 WORKBENCH_TEST_LAB=1")
database = "v3_migrations_" + uuid4().hex
env = dict(os.environ, PGPASSWORD=(runtime / "db-password").read_text().strip())
conn = ["-h", "127.0.0.1", "-p", "54459", "-U", "workbench"]
env["DATABASE_URL"] = "postgresql://workbench@127.0.0.1:54459/" + database + "?sslmode=disable"

def query(sql):
    return subprocess.check_output([pg / "psql", *conn, "-XAtq", "-v", "ON_ERROR_STOP=1", "-d", database],
                                   input=sql, text=True, env=env).strip()

def migrate(cwd, direction):
    run = subprocess.run([tools / "bin/migrate", direction], cwd=cwd, env=env, text=True, capture_output=True)
    if run.returncode:
        raise RuntimeError(run.stderr[-1800:] + run.stdout[-600:])

subprocess.run([pg / "createdb", *conn, database], check=True, env=env)
try:
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp)
        (base / "migrations").mkdir()
        for script in (tools / "migrations").glob("*.sql"):
            if int(script.name.split("_")[0]) <= 630:
                (base / "migrations" / script.name).symlink_to(script)
        migrate(base, "up")
        ws = query("INSERT INTO workspace(name,slug) VALUES('迁移验收','v3-history') RETURNING id")
        original = query(f"INSERT INTO agent(workspace_id,name,runtime_mode) VALUES('{ws}','Work','local') RETURNING id")
        for script in (tools / "migrations").glob("*.sql"):
            if 631 <= int(script.name.split("_")[0]) <= 655:
                (base / "migrations" / script.name).symlink_to(script)
        migrate(base, "up")
        sender = query("""INSERT INTO "user"(name,email) VALUES('历史成员','history@example.invalid') RETURNING id""")
        room = query(f"""INSERT INTO collaboration_room(workspace_id,owner_id,title,kind)
                         VALUES('{ws}','{sender}','升级前的会话','group') RETURNING id""")
        legacy = query(f"""INSERT INTO collaboration_message(room_id,sender_id,request_id,content,filename,file_bytes)
                           VALUES('{room}','{sender}',gen_random_uuid(),'','原件.bin',decode('00ff3a','hex')) RETURNING id""")
        archived_agent = query(f"""INSERT INTO agent(workspace_id,name,runtime_mode,archived_at)
                                   VALUES('{ws}','升级前已归档对象','local',now()) RETURNING id""")
        historical_issue = query(f"""INSERT INTO issue(workspace_id,number,title,status,creator_type,creator_id,
                                                     assignee_type,assignee_id)
                                    VALUES('{ws}',1,'旧版任务归属','todo','member','{sender}',
                                           'agent','{archived_agent}') RETURNING id""")
        historical_link = query(f"""INSERT INTO issue_reference_url(issue_id,url,creator_id)
                                  VALUES('{historical_issue}','https://example.invalid/legacy','{sender}') RETURNING id""")
        migrate(tools, "up")
        assert query(f"SELECT url='https://example.invalid/legacy' AND title='' FROM issue_reference_url WHERE id='{historical_link}'") == "t"
        assert query(f"""SELECT id=message_id AND filename='原件.bin' AND position=0 AND encode(content,'hex')='00ff3a'
                         FROM collaboration_file WHERE id='{legacy}'""") == "t"
        assert query(f"SELECT selected_agent_id IS NULL FROM collaboration_message WHERE id='{legacy}'") == "t"
        work = query(f"SELECT id FROM workspace_work WHERE workspace_id='{ws}'")
        assert query(f"SELECT count(*) FROM collaboration_room_agent WHERE room_id='{room}'") == "0"
        query(f"INSERT INTO collaboration_room_agent VALUES('{room}','{work}') ON CONFLICT DO NOTHING")
        query(f"INSERT INTO collaboration_room_agent VALUES('{room}','{work}') ON CONFLICT DO NOTHING")
        assert query(f"SELECT count(*) FROM collaboration_room_agent WHERE room_id='{room}' AND agent_id='{work}'") == "1"

        assert query(f"""SELECT status='todo' AND assignee_id='{archived_agent}'
                         FROM issue WHERE id='{historical_issue}'""") == "t"
        assert query("""SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND
                        tgname IN ('mw_check_issue_assignment','mw_guard_queue_agent',
                                   'mw_archive_agent_work','mw_archive_squad_work')""") == "4"
        query(f"UPDATE issue SET assignee_type='member',assignee_id='{sender}' WHERE id='{historical_issue}'")
        assert work != original
        assert query(f"SELECT name FROM agent WHERE id='{original}'") == "Work"
        assert query(f"SELECT name FROM agent WHERE id='{work}'") == "Work（内置）"
        assert query("SELECT count(*) FROM schema_migrations WHERE version >= '631_'") == str(len(list((root/"deploy/v3/server/migrations").glob("*.up.sql"))))
        migrate(tools, "up")
        migrate(root / "deploy/v3/server", "down")
        assert query("SELECT max(version) FROM schema_migrations").startswith("630_")
        assert query("SELECT count(*) FROM pg_trigger WHERE tgname='mw_archive_agent_work'") == "0"
        migrate(tools, "up")
        assert query(f"SELECT id FROM workspace_work WHERE workspace_id='{ws}'") == work
        print("PASS 空库基础迁移、已有同名 Work 的 V2 工作区升级、V3 全量重复执行、回滚和重新升级，保留智能体 ID，655 版会话旧附件的下载 ID、文件名与原字节升级后可回读；658 保留旧版归属并可改派，归档触发器可回滚；659 保留历史链接 ID 和 URL；660 旧群空智能体名单、重复加入去重")
finally:
    subprocess.run([pg / "dropdb", *conn, database], check=True, env=env)
