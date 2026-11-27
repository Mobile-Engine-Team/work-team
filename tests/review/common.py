"""Shared helpers for project and workbench acceptance on synthetic profiles."""
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from playwright.sync_api import expect

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / ".local/v2-runtime"
BASE = ROOT / "docs/demo-v2-baseline"
API = "http://127.0.0.1:19015"


class Review:
    def __init__(self, out):
        self.out = out
        out.mkdir(parents=True, exist_ok=True)
        self.report = {"accounts": {}, "checks": []}
        self.save()

    def save(self):
        (self.out / "results.json").write_text(json.dumps(self.report, indent=2, ensure_ascii=False) + "\n")

    def check(self, ids, condition, observed, role="A", image=None):
        row = {"ids": ids.split(), "condition": condition, "observation": observed, "role": role, "status": "pass"}
        if image:
            row["image"] = image + ".png"
        self.report["checks"].append(row)
        self.save()
        print("PASS", ids, observed, flush=True)

    def shot(self, page, name):
        page.evaluate("document.fonts.ready")
        page.screenshot(path=str(self.out / (name + ".png")), animations="disabled")


def api(method, path, token=None, body=None, workspace=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if workspace:
        headers["X-Workspace-ID"] = workspace
    request = Request(API + path, headers=headers, method=method,
                      data=json.dumps(body).encode() if body is not None else None)
    with urlopen(request, timeout=10) as response:
        raw = response.read()
    return json.loads(raw) if raw else None


def seed():
    # Direct invocations of review/run.py must stay on the replay API, too.
    if (RUNTIME / "model.private.json").is_file():
        raise RuntimeError("请在独立的本地模型验收资料运行回放")
    tag = secrets.token_hex(4)
    password = secrets.token_urlsafe(18)
    accounts = [api("POST", "/auth/password/register", body={"username": "review_" + label + tag, "password": password})
                for label in ("a", "b")]
    a, b = accounts
    workspace = api("POST", "/api/workspaces", a["token"], {"name": "基线协作组", "slug": "baseline-" + tag})
    wid = workspace["id"]
    api("POST", f"/api/workspaces/{wid}/members", a["token"], {"email": b["user"]["email"], "role": "member"})
    invitation = next(i for i in api("GET", "/api/invitations", b["token"]) if i["workspace_id"] == wid)
    api("POST", "/api/invitations/" + invitation["id"] + "/accept", b["token"], {})
    issue = api("POST", "/api/issues", a["token"], {"title": "核对交接清单", "description": "请核对附件中的两项约定",
                                                  "status": "done", "suppress_run": True}, wid)
    return accounts, password, workspace, issue


def sql(statement, **bindings):
    pg_bin = Path(os.environ.get("WORKBENCH_PG_BIN", ROOT.parents[1] / ".local/mvp-single-mac-2026-11-05/state/pg-tools/bin"))
    env = {**os.environ, "PGPASSWORD": (RUNTIME / "db-password").read_text()}
    command = [pg_bin / "psql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", "54359",
               "-U", "workbench", "-d", "workbench"]
    for key, value in bindings.items():
        command.extend(["-v", key + "=" + str(value)])
    return subprocess.check_output(command, input=statement, text=True, env=env).strip()


def answers(ws, owner, iid):
    fixtures = json.loads((BASE / "replay/answers.json").read_text().replace("{issueId}", iid))
    for item in fixtures:
        sql("""
          WITH c AS (
            INSERT INTO workbench_conversation(workspace_id,owner_id,title)
            VALUES (:'ws',:'owner',:'title') RETURNING id
          ) INSERT INTO workbench_message(id,conversation_id,workspace_id,owner_id,prompt,status,result)
            SELECT gen_random_uuid(),id,:'ws',:'owner',:'prompt','completed',:'result'::jsonb FROM c;
        """, ws=ws, owner=owner, title=item["title"], prompt=item["prompt"], result=json.dumps(item["result"], ensure_ascii=False))


def button(scope, name):
    return scope.get_by_role("button", name=name, exact=isinstance(name, str)).last


def click(scope, name):
    button(scope, name).click()


def select(page, field, value):
    page.get_by_role("combobox", name=field, exact=True).click()
    page.get_by_role("option", name=re.compile(re.escape(value))).first.click()


def signin(page, account, password, slug):
    if button(page, "退出账号").is_visible():
        click(page, "退出账号")
    page.get_by_role("textbox", name="账号", exact=True).fill(account["user"]["name"])
    page.locator("input[type=password]").fill(password)
    page.locator("form button[type=submit]").click()
    select(page, "工作区", "基线协作组")
    expect(page).to_have_url(re.compile("/team/" + slug))


def open_page(pw, profile, port):
    if port:
        browser = pw.chromium.connect_over_cdp("http://127.0.0.1:" + str(port))
        expected_port = 19016 if profile == "a" else 19017
        return next(p for p in browser.contexts[0].pages if urlparse(p.url).port == expected_port)
    browser = pw.chromium.launch(channel="chrome")
    ctx = browser.new_context(viewport={"width":1180, "height":810}, device_scale_factor=2,
                              color_scheme="light", locale="en-US", timezone_id="Asia/Shanghai")
    page = ctx.new_page()
    try:
        page.goto((RUNTIME / profile / "entry.private").read_text().strip(), wait_until="domcontentloaded")
    except Exception:
        raise RuntimeError("无法打开 " + profile.upper() + " 的本机 DSH 入口") from None
    return page
