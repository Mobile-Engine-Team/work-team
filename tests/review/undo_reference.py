"""Compare the same edit history gesture on the frozen and assembled renderers.
The frozen frontend URL is explicitly provided. Both use synthetic teams and the
private workbench API; no original database or user is accessed.
"""
import argparse
import plistlib
from pathlib import Path
import re
from urllib.parse import urlparse
from playwright.sync_api import expect, sync_playwright
from common import API, RUNTIME, Review, api, button, click, open_page, seed, select, signin


def observe(p, role, original):
    accounts, password, ws, issue = seed()
    a = accounts[0]
    api("POST", "/api/projects", a["token"], {"title":"撤销对照项目"}, ws["id"])
    if original:
        # The fixture API has its own CORS allowlist. Forward locally with its normal
        # bearer token, preserving request body and Multica status exactly.
        def forward(route):
            response = route.fetch()
            route.fulfill(response=response, headers={**response.headers, "access-control-allow-origin":"http://127.0.0.1:14683",
                                                      "access-control-allow-credentials":"true"})
        p.route(API + "/**",forward)
    signin(p,a,password,ws["slug"])
    click(p,"项目")
    click(p,re.compile("撤销对照项目"))
    click(p,"施工蓝图")
    click(p,"编辑草案")
    click(p,"新增任务")
    p.get_by_role("textbox",name="任务标题").fill("核对交付")
    click(p,"加入已有任务")
    click(p.get_by_role("dialog"),re.compile("核对交接清单"))
    expect(p.get_by_role("dialog").get_by_text("暂无可加入的任务")).to_be_visible()
    p.keyboard.press("Escape")
    select(p,"添加前置任务","核对交付")
    label = re.compile("核对交付 → 核对交接清单")
    click(p,label)
    p.get_by_role("textbox", name="下游需要什么").fill("上游确认后交接")
    expect(p.locator(".project-save-state")).to_contain_text("已保存")
    click(p,"删除连线")
    expect(button(p,"删除连线")).to_have_count(0)
    click(p,"撤销")
    p.locator("article").filter(has_text="核对交接清单").locator("strong").click()
    restored = button(p,label).is_visible()
    click(p,"重做")
    redone = button(p,label).is_visible()
    return a["user"]["name"], {"undoRestoredEdge":restored,"redoHasEdge":redone,"slug":ws["slug"]}


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    report=Review(args.output)
    report.report.update(build=plistlib.loads((RUNTIME/"desktop/Team Workbench.app/Contents/Info.plist").read_bytes())["WorkbenchBuild"], frozenClient="dbf36f4", frozenMultica="a7859a4")
    with sync_playwright() as pw:
        b=pw.chromium.launch(channel="chrome")
        page=b.new_page()
        page.goto("http://127.0.0.1:14683/team-pilot.html")
        for role, p in [("冻结",page),("产品",open_page(pw,"a",None))]:
            user,row=observe(p,role,role=="冻结")
            report.report["accounts"][role]=user
            report.report[role]=row
            report.save()
    src,res=report.report["冻结"],report.report["产品"]
    for key in ["undoRestoredEdge","redoHasEdge"]:
        assert src[key] == res[key], (key,src,res)
    report.check("BP-08","同一组动作、同一 Multica 构建、各自新团队","撤销删除后是否恢复连线为 "+str(src["undoRestoredEdge"])+"，重做后是否有连线为 "+str(src["redoHasEdge"])+"，两端相同。")
