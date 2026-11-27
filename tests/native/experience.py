"""Replay the four hand-acceptance fixes against a signed bundle and the local CLI fixture."""
import argparse
import json
from pathlib import Path
import plistlib
import re
import secrets
import subprocess
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright
from agents import sql
from shell import DEFAULT, LAB, PORT, launch, quit_process, wait_page
from support import btn, click, close, combo, dialog, field, stamp
from workspaces import register


TRANSPORT = "**/api/workbench/transport*"


def target(request):
    return parse_qs(urlsplit(request.url).query).get("path", [""])[0]


def invitation(app, a, b, owner, member, slug):
    click(a, "新建工作区")
    form = dialog(a)
    name = field(form, "名称")
    expect(name).to_be_focused()
    name.fill("亲验协作组")
    field(form, "工作区地址").fill(slug)
    click(form, "创建")
    expect(a.get_by_role("combobox", name="工作区")).to_contain_text("亲验协作组")
    click(a, "成员与智能体")
    click(a, "邀请成员")
    dialog(a).get_by_role("textbox").fill(member)
    click(dialog(a), "保存")

    toast = b.locator(".team-invite-toast")
    expect(toast).to_contain_text("亲验协作组", timeout=20000)
    workspace_picker = b.get_by_role("combobox", name="工作区")
    rejected_accept = False
    accepted = False
    block_workspace = True
    rejected_workspace = False

    def fail_once(route):
        nonlocal rejected_accept, accepted, rejected_workspace
        path = target(route.request).rstrip("/")
        if re.fullmatch(r"/api/invitations/[^/]+/accept", path):
            if not rejected_accept:
                rejected_accept = True
                route.fulfill(status=409, json={"error": "回放拒绝这次接受"})
            else:
                response = route.fetch()
                accepted = response.status == 200
                route.fulfill(response=response)
        elif accepted and block_workspace and path == "/api/workspaces":
            rejected_workspace = True
            route.fulfill(status=404, json={"error": "回放拒绝一次团队详情读取"})
        else:
            route.continue_()

    b.route(TRANSPORT, fail_once)
    def accept_response(response):
        return re.fullmatch(r"/api/invitations/[^/]+/accept", target(response.request).rstrip("/")) is not None

    try:
        with b.expect_response(accept_response) as first:
            click(toast, "接受邀请")
        assert first.value.status == 409
        expect(toast.get_by_role("alert")).to_contain_text("操作未完成")
        expect(workspace_picker).to_contain_text("个人工作区")
        assert rejected_accept
        with b.expect_response(accept_response) as second:
            click(toast, "接受邀请")
        assert second.value.status == 200, (second.value.status, second.value.json())
        expect(toast.get_by_role("alert")).to_contain_text("操作未完成")
        expect(workspace_picker).to_contain_text("个人工作区")
        assert accepted and rejected_workspace
        block_workspace = False
        click(toast, "接受邀请")
        expect(workspace_picker).to_contain_text("亲验协作组")
        expect(b).to_have_url(re.compile(r"#/team/" + re.escape(slug) + "$"))
        expect(toast).not_to_be_visible()
    finally:
        b.unroute(TRANSPORT, fail_once)
    click(b, "成员与智能体")
    for account in (owner, member):
        expect(b.get_by_text(account, exact=True).first).to_be_visible()
    rows = sql(app, """
        select u.name || '|' || m.role from member m
        join public."user" u on u.id=m.user_id join workspace w on w.id=m.workspace_id
        where w.slug=:'slug';
    """, slug=slug).splitlines()
    assert set(rows) == {owner + "|owner", member + "|member"}


def model_picker(page):
    click(page, "启用本机执行端")
    expect(btn(page, "停用本机执行端")).to_be_visible(timeout=45000)
    click(page, "新建智能体")
    form = dialog(page)
    combo(form, "选择执行端", re.compile("Codex", re.I))
    click(form, "模型（可选）")
    popup = page.locator(".team-model-popup")
    expect(popup).to_contain_text("内置或备用模型目录仅供参考")
    expect(popup).to_contain_text("fixture-bundled-model", timeout=30000)
    click(popup, "认证与配置")
    panel = popup.locator(".team-auth-panel")
    expect(panel).to_contain_text("登录或导入仅授权当前账号在此客户端的执行端")
    expect(panel).to_contain_text("当前执行端尚未配置 Codex 授权")
    click(panel, "登录 Codex")
    expect(popup).to_contain_text("已检测到当前执行端的 Codex 授权", timeout=20000)
    expect(panel).not_to_be_visible()
    expect(popup).to_contain_text("fixture-authorized-model", timeout=30000)
    expect(popup.get_by_text("fixture-bundled-model", exact=True)).to_have_count(0)

    def fail_refresh(route):
        if route.request.method == "POST" and re.fullmatch(r"/api/runtimes/[^/]+/models\?force=true", target(route.request)):
            route.fulfill(status=404, json={"error": "回放模型目录刷新失败"})
        else:
            route.continue_()

    page.route(TRANSPORT, fail_refresh)
    try:
        click(popup, "刷新模型")
        expect(popup.get_by_role("alert")).to_contain_text("模型目录刷新失败，仍显示上次结果")
        expect(popup).to_contain_text("fixture-authorized-model")
    finally:
        page.unroute(TRANSPORT, fail_refresh)
    click(popup, "刷新模型")
    expect(popup.get_by_role("alert")).not_to_be_visible(timeout=30000)
    popup.get_by_placeholder("搜索模型名称或 ID").fill("fixture-authorized")
    click(popup, re.compile("Fixture Authorized Model"))
    expect(btn(form, "模型（可选）")).to_contain_text("Fixture Authorized Model")
    field(form, "名称").fill("亲验 Codex 助手")
    click(form, "保存")
    expect(form).not_to_be_visible()


def agent_actions(page):
    row = page.locator(".team-agent-row").filter(has_text="亲验 Codex 助手")
    buttons = row.get_by_role("button")
    expected = ["测试模型调用", "编辑智能体", "删除智能体", "更多操作"]
    names = buttons.evaluate_all(
        "(buttons) => buttons.map((button) => button.getAttribute('aria-label') || button.textContent.trim())"
    )
    assert names == expected, names
    boxes = [buttons.nth(i).bounding_box() for i in range(len(expected))]
    assert all(boxes)
    assert [box["x"] for box in boxes] == sorted(box["x"] for box in boxes)
    buttons.first.focus()
    for position in range(1, len(expected)):
        page.keyboard.press("Tab")
        expect(buttons.nth(position)).to_be_focused()
    page.keyboard.press("Enter")
    page.get_by_role("menuitem", name="认证与配置").click()
    expect(dialog(page)).to_contain_text("登录或导入仅授权当前账号在此客户端的执行端")
    close(page)
    click(row, "测试模型调用")
    click(dialog(page), "测试模型调用")
    expect(dialog(page).get_by_role("status").filter(has_text="模型调用通过")).to_be_visible(timeout=65000)


def run(app, out):
    product = app / "Contents/Resources/product"
    env = {"HOME": str(Path.home()), "PATH": "/usr/bin:/bin", "WORKBENCH_TEST_LAB": "1", "WORKBENCH_RUNTIME": str(LAB)}
    tag = secrets.token_hex(4)
    owner, member = "ux_a_" + tag, "ux_b_" + tag
    out.parent.mkdir(parents=True, exist_ok=True)
    report = {"build": plistlib.loads((app/"Contents/Info.plist").read_bytes())["WorkbenchBuild"],
              "surface": "native isolated-replay", "checks": []}

    def passed(ids, observation):
        report["checks"].append({"ids": ids, "observation": observation, "status": "pass"})
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        print("PASS", " ".join(ids), observation, flush=True)

    pids = []
    try:
        with sync_playwright() as driver:
            pids.append(launch(app))
            pids.append(launch(app, "b", PORT + 1))
            a, b = wait_page(driver), wait_page(driver, PORT + 1)
            password = secrets.token_urlsafe(22)
            register(a, owner, password)
            register(b, member, password)
            invitation(app, a, b, owner, member, "ux-" + tag)
            passed(["V2-UX-01"], "拒绝接受及已加入但团队读取失败时均留在个人区，重试后直接进入所邀团队，成员仅写入一次。")
            model_picker(a)
            passed(["V2-UX-03"], "未授权提示内置目录，受控登录后自动发现新目录，刷新失败保留结果，重试可按 ID 搜索并保存。")
            agent_actions(a)
            passed(["V2-UX-02", "V2-UX-04"], "更多操作位于删除右侧，Tab 顺序一致，认证弹窗说明账号和客户端范围，本机受控模型探针通过。")
    finally:
        try:
            for pid in reversed(pids):
                quit_process(pid)
        finally:
            subprocess.run(["/usr/bin/python3", product/"scripts/local", "stop"], env=env, check=True)
    report.update(status="pass", finished=stamp())
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", type=Path, default=DEFAULT)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    run(args.app.resolve(), args.output.resolve())
