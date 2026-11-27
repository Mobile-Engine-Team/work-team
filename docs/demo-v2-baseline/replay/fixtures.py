"""给 desktop.py 的新复验库补充两个已完成回答。运行前先完成任务 TK-05。"""
import argparse
import json
from pathlib import Path
import re
import runpy
import subprocess
import uuid

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("database", help="desktop.py 输出的本轮数据库名")
parser.add_argument("--pages", action="store_true", help="向独立的分页种子工作区补齐 101 件任务")
args = parser.parse_args()
if not re.fullmatch(r"v2_chat_verify_review_\d{8}_\d{6}_[a-f0-9]{6}", args.database):
    parser.error("仅接受 desktop.py 创建的带随机后缀的新库")

here = Path(__file__).resolve().parent
root = next(p for p in here.parents if (p / "project/current.md").is_file())
pg = runpy.run_path(str(root / ".local/demo-v2/aliyun-20261117/localdb.py"))
env = pg["env"]()
if (env["PGHOST"], env["PGPORT"]) != ("127.0.0.1", "54329"):
    raise RuntimeError("本机复验库位置不符")
command = [pg["TOOL"] / "psql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-d", args.database]
if args.pages:
    subprocess.run(command + ["-f", here / "pages.sql"], env=env, check=True)
    print("分页样本已就绪，请在原版刷新任务列表。")
    raise SystemExit(0)

query = """
select w.id,u.id,i.id
from workspace w join member m on m.workspace_id=w.id
join public."user" u on u.id=m.user_id
join issue i on i.workspace_id=w.id
where w.slug='baseline-team' and u.name='baseline_a' and m.role='owner'
and i.title='核对交接清单';
"""
identity = subprocess.check_output(command, input=query, env=env, text=True).splitlines()
if len(identity) != 1:
    raise RuntimeError("请先在新库通过界面完成指定团队、所有者和唯一的清单任务")
workspace, owner, issue = [str(uuid.UUID(value)) for value in identity[0].split("|")]
fixtures = json.loads((here / "answers.json").read_text().replace("{issueId}", issue))
for item in fixtures:
    bindings = {"cid": str(uuid.uuid4()), "mid": str(uuid.uuid4()), "wid": workspace,
                "uid": owner, "title": item["title"], "prompt": item["prompt"],
                "result": json.dumps(item["result"], ensure_ascii=False)}
    variables = [arg for key, value in bindings.items() for arg in ("-v", key + "=" + value)]
    subprocess.run(command + variables, input="""
begin;
select pg_advisory_xact_lock(hashtext(:'wid'||':'||:'uid'||':'||:'title'));
insert into workbench_conversation(id,workspace_id,owner_id,title)
select :'cid',:'wid',:'uid',:'title' where not exists
(select 1 from workbench_conversation where workspace_id=:'wid' and owner_id=:'uid' and title=:'title');
insert into workbench_message(id,conversation_id,workspace_id,owner_id,prompt,status,result)
select :'mid',id,workspace_id,owner_id,:'prompt','completed',:'result'::jsonb
from workbench_conversation where id=:'cid';
commit;
""", text=True, env=env, check=True)
print("请刷新 A 的团队工作台，从最近对话进入两份已存回答。")
