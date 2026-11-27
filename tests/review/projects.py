import re
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect

from common import api, button, click, select, sql


def project(page):
    click(page, "项目")
    click(page, re.compile("交接演练"))


def edit_node(page):
    project(page)
    click(page, "施工蓝图")
    expect(page.get_by_role("combobox", name="定位任务")).to_be_visible()
    if button(page, "编辑草案").is_visible():
        click(page, "编辑草案")
    select(page, "定位任务", "核对交付")
    if button(page, "编辑草案").is_visible():
        click(page, "编辑草案")
    expect(page.get_by_role("textbox", name="交付要求")).to_be_editable()


def run(review, a, b, accounts, workspace):
    wid = workspace["id"]
    d = a.get_by_role("dialog")
    click(a, "项目")
    click(a, "新建项目")
    title = d.get_by_role("textbox", name="项目名称")
    expect(title).to_be_focused()
    expect(button(d, "新建项目")).to_be_disabled()
    review.shot(a, "17-project-new")
    title.fill("丢弃这次输入")
    a.keyboard.press("Escape")
    click(a, "新建项目")
    expect(title).to_have_value("")
    title.fill("交接演练")
    d.get_by_role("textbox", name="目标与交付标准").fill("复核交付清单")
    click(d, "新建项目")
    expect(button(a, "项目设置")).to_be_visible()
    review.shot(a, "18-project")
    project(b)
    expect(button(b, "项目设置")).to_have_count(0)
    expect(b.get_by_text("交接演练", exact=True).first).to_be_visible()
    assert sql("select count(*) from project where workspace_id=:'ws' and title='交接演练'", ws=wid) == "1"
    review.check("PJ-01 PJ-02 PJ-04 PJ-06", "空团队，A 新建项目，B 打开总览", "首焦点、必填、取消重开、成功页和单条落库符合；A 有设置，普通成员 B 只能查看。", "A/B", "18-project")
    click(a, "项目设置")
    expect(d.get_by_role("textbox", name="项目名称")).to_have_value("交接演练")
    a.keyboard.press("Escape")
    review.check("PJ-03", "所有者打开项目设置", "读回项目名和已有目标，Esc 关闭。")
    click(a, "开始讨论")
    click(a, "新建话题")
    d.get_by_role("textbox").first.fill("交付口径")
    d.get_by_role("textbox").last.fill("测试依据来自清单")
    click(d, re.compile("创建|新建"))
    expect(a.get_by_text("测试依据来自清单", exact=True).first).to_be_visible()
    click(a, "整理结论")
    expect(button(d, "确认结论")).to_be_disabled()
    review.shot(a, "19-conclusion")
    d.locator("textarea").last.fill("按清单验收")
    click(d, "保留草稿")
    click(a, "整理结论")
    expect(d.locator("textarea").last).to_have_value("按清单验收")
    click(d, "确认结论")
    expect(a.get_by_text("按清单验收", exact=True).first).to_be_visible()
    review.check("TP-01 TP-02 TC-01 TC-02 TC-03 STATE-04", "A 创建话题、保存并重开结论草稿、确认", "话题出现初始正文，空草稿不能确认，重开读到原文，确认后出现正式结论。", image="19-conclusion")
    click(a, "带此话题进入蓝图")
    expect(a.get_by_text("按清单验收", exact=False).first).to_be_visible()
    review.shot(a, "20-blueprint")
    click(a, "编辑草案")
    click(a, "新增任务")
    node = a.get_by_role("textbox", name="任务标题")
    expect(node).to_be_visible()
    review.shot(a, "21-blueprint-node")
    node.fill("核对交付")
    a.get_by_role("textbox", name="交付要求").fill("由成员确认")
    click(a, "保存")
    click(a, "查看变更并发布")
    expect(button(d, "发布 V1")).to_be_visible()
    review.shot(a, "22-publish-preview")
    assert sql("select count(*) from issue where workspace_id=:'ws' and title='核对交付'", ws=wid) == "0"
    click(d, "发布 V1")
    expect(d).to_have_count(0)
    click(a, "查看可推进任务")
    expect(d.get_by_text(re.compile("请先指定负责人")).first).to_be_visible()
    expect(d.get_by_role("checkbox").first).to_be_disabled()
    review.shot(a, "23-start-preview")
    a.keyboard.press("Escape")
    assert sql("select count(*) from issue where workspace_id=:'ws' and title='核对交付'", ws=wid) == "1"
    review.check("TP-03 BP-01 BP-02 BP-03 BP-12 BP-13 ST-01 TK-10", "A 带 V1 结论入图，新增未指派节点并发布", "草案和预览无任务，发布后仅一条任务。推进弹窗阻止未指派节点。", image="23-start-preview")
    edit_node(a)
    select(a, "负责人", accounts[1]["user"]["name"])
    if button(a, "保存").is_visible() and button(a, "保存").is_enabled():
        click(a, "保存")
    click(a, "用 AI 调整蓝图")
    # Entering directly from the project card has cleared the topic context.
    click(d, "查看本次发送的输入")
    expect(d.get_by_text(re.compile("不纳入话题")).first).to_be_visible()
    a.keyboard.press("Escape")
    review.check("BP-04 BP-10 PL-01 PL-02", "定位既有节点并将负责人改为 B；打开 AI 输入预览", "定位与右栏联动，预览明确指出未纳入话题。未申请模型执行。")
    click(a, "查看变更并发布")
    click(d, "发布 V2")
    expect(d).to_have_count(0)
    click(a, "查看可推进任务")
    d.get_by_role("checkbox").first.check()
    click(d, re.compile("1"))
    expect(d.get_by_text("已通知负责人，待其开展")).to_be_visible()
    click(d, "完成并关闭")
    click(b, "收件箱")
    expect(b.get_by_text(re.compile("核对交付")).first).to_be_visible()
    review.check("ST-02", "A 推进 V2 正式版中的人类负责人任务", "界面确认已通知，B 的收件箱读到该任务。", "A/B")
    edit_node(b)
    expect(button(b, "查看变更并发布")).to_have_count(0)
    review.check("BP-14", "普通成员 B 进入已发布项目的编辑草案", "B 可编辑任务要求，无发布控件。", "B")
    edit_node(a)
    held = []
    def delay(route):
        path = parse_qs(urlparse(route.request.url).query).get("path", [""])[0]
        if path.endswith("/blueprint/draft") and route.request.headers.get("x-workbench-method") == "PUT":
            held.append(route)
        else:
            route.continue_()
    b.route("**/api/workbench/transport?*", delay)
    b.get_by_role("textbox", name="交付要求").fill("B 的冲突选择稿")
    for _ in range(40):
        b.wait_for_timeout(100)
        if held:
            break
    assert held, "B 的草案保存请求未出现"
    with a.expect_response(lambda r: r.request.headers.get("x-workbench-method") == "PUT" and
                           "blueprint" in r.url and r.status == 200):
        a.get_by_role("textbox", name="交付要求").fill("A 的远端已保存稿")
    for route in held:
        route.continue_()
    b.unroute("**/api/workbench/transport?*", delay)
    conflict = b.get_by_role("dialog", name="需要合并修改")
    expect(button(conflict, "合并并保存")).to_be_disabled()
    b.keyboard.press("Escape")
    expect(conflict).to_be_visible()
    # The frozen B screenshot includes an unrelated pending workspace invitation.
    pending = api("POST", "/api/workspaces", accounts[0]["token"],
                  {"name": "queued-ws-return", "slug": workspace["slug"] + "-return"})
    api("POST", f"/api/workspaces/{pending['id']}/members", accounts[0]["token"],
        {"email": accounts[1]["user"]["email"], "role": "member"})
    expect(b.get_by_text("queued-ws-return", exact=True)).to_be_visible(timeout=15000)
    review.shot(b, "40-blueprint-conflict")
    conflict.get_by_role("radio", name=re.compile("保留我的修改")).check()
    click(conflict, "合并并保存")
    expect(conflict).to_have_count(0)
    a.reload()
    edit_node(a)
    expect(a.get_by_role("textbox", name="交付要求")).to_have_value("B 的冲突选择稿")
    review.check("BP-11 BP-15 BP-16", "同一 revision，先存 A，再放行 B", "未选择时不能合并，Esc 保留弹窗；选 B 的要求后 A 刷新读回相同草案。", "A/B", "40-blueprint-conflict")
    click(a, "版本历史")
    expect(d.get_by_text(re.compile("V1")).first).to_be_visible()
    a.keyboard.press("Escape")
    review.check("BP-17", "两个正式版和一个更新草案", "版本历史中可查看早先发布的版本。")
    click(b, "收件箱")
    additions(review, a, workspace)
    click(a, "讨论")
    click(a, re.compile("交付口径"))
    click(a, "创建后续任务")
    expect(d.get_by_text(re.compile("按清单验收")).first).to_be_visible()
    d.get_by_role("textbox", name="任务标题").fill("处理已确认结论")
    click(d, "创建任务")
    expect(d).to_have_count(0)
    expect(a.get_by_text(re.compile("处理已确认结论")).first).to_be_visible()
    assert sql("select count(*) from issue where workspace_id=:'ws' and title='处理已确认结论'", ws=wid) == "1"
    click(a, "关联已有任务承接")
    expect(button(d, "保存")).to_be_disabled()
    a.keyboard.press("Escape")
    a.get_by_text("项目安排与其他处理", exact=True).click()
    click(a, "仅记录，无需执行")
    d.locator("textarea").fill("复核留档，不派工")
    click(d, "保存")
    expect(d).to_have_count(0)
    a.get_by_text(re.compile("^仅记录，无需执行 · V1")).first.click()
    expect(a.get_by_text("复核留档，不派工")).to_be_visible()
    review.check("TC-12", "已确认的 V1 选择仅记录", "返回同一话题，V1 历史项内可以展开查看说明。")
    click(a, "关闭话题")
    expect(button(a, "重新打开")).to_be_visible()
    project(b)
    click(b, "讨论")
    click(b, re.compile("交付口径"))
    with b.expect_response(lambda r: r.status == 403 and "topics" in r.url):
        click(b, "重新打开")
    expect(b.get_by_text("操作未完成", exact=True).first).to_be_visible()
    review.check("TC-08 TC-09 TC-10 TC-11 TP-04 TP-05 TK-09", "A 使用结论创建后续任务并关闭话题；B 尝试重开", "任务附结论且仅写一次，关联弹窗需选目标；普通成员请求得到 403 并留在话题。", "A/B")
    click(a, "重新打开")
    click(a, "整理结论")
    d.locator("textarea").last.fill("第二版需要额外复核")
    click(d, "确认结论")
    expect(a.get_by_text("第二版需要额外复核", exact=True).first).to_be_visible()
    adoption = sql("""select f.conclusion_revision,c.content from project_topic_followup f
       join issue i on i.id=f.issue_id join project_topic_conclusion c
       on c.topic_id=f.topic_id and c.revision=f.conclusion_revision
       where i.workspace_id=:'ws' and i.title='处理已确认结论'""",ws=wid)
    assert adoption == "1|按清单验收", adoption
    review.check("TC-04", "话题已确认 V2，查询按 V1 创建的后续任务", "任务继续引用 V1 与当时的结论原文。")
    edit_node(a)
    click(a, "新增任务")
    a.get_by_role("textbox",name="任务标题").fill("汇总交付")
    select(a,"负责人",accounts[1]["user"]["name"])
    select(a,"添加前置任务","核对交付")
    click(a,"查看变更并发布")
    click(d,"发布 V3")
    expect(d).to_have_count(0)
    a.locator('.team-content nav').get_by_role("button",name=re.compile("任务")).click()
    click(a,re.compile("核对交付"))
    expect(button(a,"返回来源项目")).to_be_visible()
    select(a,"状态","已完成")
    click(a,"查看可交接任务")
    expect(d.get_by_text("汇总交付",exact=True)).to_be_visible()
    expect(d.get_by_text("核对交付",exact=True)).to_have_count(0)
    expect(d.get_by_role("checkbox")).to_have_count(1)
    a.keyboard.press("Escape")
    click(a,"返回来源项目")
    review.check("PJ-05 RUN-08 ST-03", "正式 V3 发布一条依赖，项目任务页打开上游并置为完成", "详情显示返回项目，交接弹窗只列直接后继‘汇总交付’，关闭后可回项目。")


def additions(review, a, workspace):
    """An existing task, dependency editing, history and discard before publication."""
    d = a.get_by_role("dialog")
    click(a, "加入已有任务")
    d.get_by_role("textbox").fill("不存在的样本xyz")
    expect(button(d,re.compile("核对交接清单"))).to_have_count(0)
    d.get_by_role("textbox").fill("核对交接清单")
    click(d,re.compile("核对交接清单"))
    expect(d.get_by_text("暂无可加入的任务")).to_be_visible()
    a.keyboard.press("Escape")
    expect(a.get_by_role("textbox", name="任务标题")).to_have_value("核对交接清单")
    select(a, "添加前置任务", "核对交付")
    click(a, re.compile("核对交付 → 核对交接清单"))
    a.get_by_role("textbox", name="下游需要什么").fill("上游确认后交接")
    expect(a.locator(".project-save-state")).to_contain_text("已保存")
    click(a, "删除连线")
    expect(button(a, "删除连线")).to_have_count(0)
    click(a, "撤销")
    a.locator("article").filter(has_text="核对交接清单").locator("strong").click()
    # In both frozen and product renderers this particular undo leaves the edge absent.
    # The separate undo_reference replay compares the two with independent new teams.
    expect(button(a, re.compile("核对交付 → 核对交接清单"))).to_have_count(0)
    click(a, "重做")
    expect(button(a, re.compile("核对交付 → 核对交接清单"))).to_have_count(0)
    click(a, "自动布局")
    a.locator("article").filter(has_text="核对交接清单").locator("strong").click()
    a.once("dialog", lambda dialog: dialog.dismiss())
    click(a, "从图移出")
    expect(a.get_by_role("textbox", name="任务标题")).to_have_value("核对交接清单")
    a.once("dialog", lambda dialog: dialog.accept())
    click(a, "从图移出")
    expect(a.locator("article").filter(has_text="核对交接清单")).to_have_count(0)
    result = sql("select count(*) from issue where workspace_id=:'ws' and title='核对交接清单'",ws=workspace["id"])
    assert result == "1"
    a.once("dialog",lambda dialog:dialog.dismiss())
    click(a, "同步任务最新内容")
    a.once("dialog",lambda dialog:dialog.accept())
    click(a, "同步任务最新内容")
    expect(a.locator(".project-save-state")).to_contain_text("已保存")
    review.check("BP-05 BP-06 BP-07 BP-08 BP-09", "在 V2 草案纳入已有任务，编辑依赖，移出并同步", "搜索选入，边可编辑、删除；本例撤销删除未恢复边，冻结版独立复验同样。取消移出保留节点，确认后真实任务仍只有一条。同步没有发布新版本。")
    assert sql("select max(number) from project_blueprint_version where workspace_id=:'ws'", ws=workspace["id"]) == "2"
