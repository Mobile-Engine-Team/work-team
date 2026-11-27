"""Exercise saved chart, prose and layout-fallback data without a model call."""
from copy import deepcopy
import json
from playwright.sync_api import expect
from common import BASE, button, click, sql


def store(ws, owner, title, result, status="completed"):
    sql("""WITH c AS (
      INSERT INTO workbench_conversation(workspace_id,owner_id,title)
      VALUES (:'ws',:'owner',:'title') RETURNING id
    ) INSERT INTO workbench_message(id,conversation_id,workspace_id,owner_id,prompt,status,result)
      SELECT gen_random_uuid(),id,:'ws',:'owner',:'title',:'status',:'result'::jsonb FROM c;""",
        ws=ws, owner=owner, title=title, status=status, result=json.dumps(result,ensure_ascii=False))


def run(review, a, workspace, owner, iid):
    wid=workspace["id"]
    base=json.loads((BASE / "replay/answers.json").read_text().replace("{issueId}",iid))[1]["result"]
    def variant(title, components):
        result=deepcopy(base)
        dy=result["dynamic"]
        result["view"]["title"]=title
        dy["plan"]["title"]=title
        dy["sections"]["main"]["surface"]["components"]=components
        return result,dy
    binding={"id":"byStatus","datasetId":"d1","op":"distribution","field":"status"}
    group={"key":"done","label":"已完成","recordId":"","total":1,"values":{"count":1},"evidenceIds":["issue:"+iid]}
    for groups,title in [([group],"状态分布"),([],"空分布")]:
        components=[{"id":"root","component":"Distribution","title":"任务按状态","data":{"@path":"/facts/byStatus/value"}}]
        result,dy=variant(title,components)
        dy["facts"]={"byStatus":{"binding":binding,"value":{"field":"status","seriesField":"","series":["count"],
            "groups":groups},"complete":True,"evidenceIds":["issue:"+iid]}}
        dy["contents"]["main"]["facts"]=[binding]
        store(wid,owner,title,result)
    prose,dy=variant("纯文本回答",[{"id":"root","component":"Prose",
            "body":"### 已核对\n这是说明。[依据链接](https://example.invalid) ![示意](https://example.invalid/i.png)"}])
    dy.update(datasets={},claims={},facts={})
    dy["sections"]["main"].update(dataRefs=[],contentRefs=[])
    store(wid,owner,"纯文本回答",prose)
    partial=deepcopy(base)
    s=partial["dynamic"]["sections"]["main"]
    s.update(sdk="unknown-historical-layout",fallback="unsupported_layout")
    s.pop("surface")
    partial["dynamic"]["complete"]=False
    store(wid,owner,"失败但保留依据",partial,"failed")
    a.reload(wait_until="domcontentloaded")
    click(a,"状态分布")
    click(a,"明细")
    expect(a.get_by_role("table")).to_contain_text("已完成")
    click(a,"图表")
    expect(a.get_by_role("table")).to_have_count(0)
    click(a,"空分布")
    expect(a.get_by_text("没有可统计的记录")).to_be_visible()
    review.check("WB-17","已存的分布回答，一组有统计，一组无记录","图表和明细双向切换；表格含已完成状态，空分组显示无统计记录。")
    click(a,"纯文本回答")
    expect(a.get_by_role("heading",name="已核对")).to_be_visible()
    expect(a.locator('.wb-main a[href*="example.invalid"], .wb-main img[src*="example.invalid"]')).to_have_count(0)
    click(a,"失败但保留依据")
    expect(button(a,"重新回答")).to_be_visible()
    expect(a.get_by_text("应复核交接附件。",exact=True)).to_be_visible()
    expect(button(a,"固定为我的视图")).to_have_count(0)
    review.check("WB-07 WB-18 OS-08","已有纯 Markdown 与部分失败的回答，包含失配的历史布局","Markdown 正常排版；链接、图片作受限文本。失败回答保留已核对的陈述，可重答且不能固定。")
