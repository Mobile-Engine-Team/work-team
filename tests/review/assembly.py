"""Check the DSH admission boundary, composed packages, API loss and session expiry.
Run outside concurrent acceptance journeys: the dedicated product A Host/API restart.
"""
import json
import os
import plistlib
from pathlib import Path
import re
import subprocess
from urllib.error import HTTPError
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright
from common import ROOT, RUNTIME, Review, button, click, open_page, seed, signin


def local(*args):
    command = os.environ.get("WORKBENCH_LOCAL_SCRIPT", str(ROOT / "scripts/local"))
    subprocess.run(["/usr/bin/python3", command, *args], cwd=ROOT,
                   env={**os.environ, "WORKBENCH_RUNTIME":str(RUNTIME)}, check=True)


def endpoint(p, path, body):
    return p.evaluate("""async ([path,body]) => (await fetch(path, {method:'POST',
        headers:{'content-type':'application/json'},body:JSON.stringify(body)})).status""", [path,body])


def main():
    accounts, password, workspace, issue = seed()
    account = accounts[0]
    slug = workspace["slug"]
    out = Path(os.environ.get("WORKBENCH_ASSEMBLY_RESULTS", ROOT / ".local/review/assembly"))
    review = Review(out)
    info = plistlib.loads((RUNTIME / "desktop/Team Workbench.app/Contents/Info.plist").read_bytes())
    review.report.update(build=info["WorkbenchBuild"], accounts={"A":account["user"]["name"]}, workspace=slug, surface="browser")
    op, bridge = "/api/workbench/operation", "/api/workbench/execution"
    try:
        urlopen("http://127.0.0.1:19016" + op)
        raise AssertionError("Unadmitted DSH connection")
    except HTTPError as error:
        assert error.code == 401
    with sync_playwright() as pw:
        try:
            local("restart","a","--variant","no-bridge","--fixture")
            a = open_page(pw,"a",None)
            expect(a.get_by_role("textbox", name="账号")).to_be_visible()
            assert endpoint(a,op,{"operation":"session.current"}) == 401
            signin(a,account,password,slug)
            assert endpoint(a,bridge,{"operation":"daemon.status"}) == 404
            click(a,"成员与智能体")
            expect(button(a,"邀请成员")).to_be_visible()
            review.check("A1 A7", "无 DSH 凭据、无产品会话及关闭执行插件", "两级身份分别拒绝未登录读取；登录后执行路由 404，团队成员页与邀请入口仍可用。")
            a.context.browser.close()
            local("restart","a","--variant","no-inbox","--fixture")
            a = open_page(pw,"a",None)
            signin(a,account,password,slug)
            expect(button(a,"收件箱")).to_have_count(0)
            a.evaluate("(s) => {location.hash='/team/'+s+'?view=inbox'}",slug)
            expect(a).to_have_url(re.compile("view=tasks"))
            expect(button(a,"新建任务")).to_be_visible()
            click(a,"智能体小队")
            review.check("A7", "用省去收件箱包的发行装配启动", "收件箱消失；旧深链回到团队任务页，小队页仍可用。")
            a.context.browser.close()
        finally:
            local("restart","a","--fixture")
        a = open_page(pw,"a",None)
        signin(a,account,password,slug)
        expect(button(a,"收件箱")).to_be_visible()
        click(a,"任务")
        expect(button(a,re.compile("核对交接清单"))).to_be_visible()
        try:
            local("stop","api")
            a.reload(wait_until="domcontentloaded")
            expect(a.get_by_role("status").filter(has_text="正在恢复连接")).to_be_visible(timeout=25000)
        finally:
            local("start","api","--fixture")
        a.reload(wait_until="domcontentloaded")
        expect(button(a,re.compile("核对交接清单"))).to_be_visible(timeout=20000)
        cookies = a.context.cookies()
        sid = next(c["value"] for c in cookies if c["name"] == "team_workbench_a")
        assert re.fullmatch(r"[A-Za-z0-9_-]{43}",sid)
        record = RUNTIME/"a/sessions"/sid
        session = json.loads(record.read_text())
        assert session["user"]["id"] == account["user"]["id"]
        session["expires"] = 1
        record.write_text(json.dumps(session))
        a.reload(wait_until="domcontentloaded")
        expect(a.get_by_role("textbox",name="账号")).to_be_visible()
        assert endpoint(a,op,{"operation":"session.current"}) == 401
        review.check("A8 AU-04 WS-02", "停产品 API 并恢复，再令测试身份过期", "断线时显示正在恢复连接，恢复后读到原任务；会话过期回登录，后续受保护读取返回 401。")
    review.report["status"] = "pass"
    review.save()
    print("Evidence",out)


if __name__=="__main__":
    main()
