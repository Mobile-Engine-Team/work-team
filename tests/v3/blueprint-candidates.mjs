import assert from "node:assert/strict";

export async function verifyBlueprintCandidates(page, workspaceId, prefix) {
  const button = name => page.getByRole("button",{name,exact:true});
  const facts = await page.evaluate(async ({workspaceId,prefix}) => {
    async function request(path,body) {
      const response = await fetch("/api/workbench/transport?path="+encodeURIComponent("/api"+path),{
        method:body ? "POST" : "GET", headers:{"content-type":"application/json","x-workspace-id":workspaceId},
        body:JSON.stringify(body),
      });
      if (!response.ok) throw Error("准备候选任务失败 "+response.status);
      return response.json();
    }
    const projects = (await request("/projects")).projects;
    const project = projects.find(p=>p.title==="体验调研");
    const row = (await request("/issues?q="+encodeURIComponent(prefix)+"&limit=100&offset=100")).issues[0];
    const local = await request("/issues",{title:"本项目可纳入的事项 "+prefix,project_id:project.id,suppress_run:true});
    return {row,local,project};
  },{workspaceId,prefix});
  assert.ok(facts.row && !facts.row.project_id);
  await button("全部项目").first().click();
  await page.getByRole("heading",{name:facts.project.title,exact:true}).click();
  await button("施工蓝图").click();
  await button("编辑草案").click();
  const dialog = page.getByRole("dialog",{name:"加入已有任务",exact:true});
  const search = dialog.getByRole("textbox");
  const results = dialog.locator(".project-candidate-list button");
  const candidate = title => results.filter({has:page.getByText(title,{exact:true})});
  const open = () => button("加入已有任务").click();
  await open();
  await candidate(facts.local.title).waitFor();
  assert.ok(await search.evaluate(el=>document.activeElement===el),"打开后可直接搜索");
  await search.fill("确定弱网复现条件");
  await dialog.locator(".project-candidate-list .team-empty").waitFor();
  assert.equal(await dialog.locator(".team-empty").innerText(),"没有可加入的任务");
  await search.fill(prefix);
  const matching = results.locator("strong").filter({hasText:new RegExp("^"+prefix+" [0-9]{3}$")});
  await matching.nth(100).waitFor({timeout:8000});
  assert.equal(await matching.count(),101);
  await search.fill("  "+facts.row.identifier.toLowerCase().slice(0,-1)+"  ");
  await candidate(facts.row.title).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".project-node").count(),0);
  const canvas = page.locator(".project-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const frame = await canvas.boundingBox();
  await page.mouse.move(frame.x+frame.width-5,frame.y+20);
  await page.mouse.down();
  await page.mouse.move(frame.x+8,frame.y+20,{steps:5});
  await page.mouse.up();
  await open();
  await search.fill(facts.row.title);
  await candidate(facts.row.title).click();
  await dialog.locator(".project-candidate-list .team-empty").waitFor();
  await page.keyboard.press("Escape");
  const node = canvas.locator(".project-node.selected").filter({hasText:facts.row.title});
  await node.waitFor();
  const nodeBox = await node.boundingBox();
  const viewport = await canvas.boundingBox();
  assert.ok(nodeBox.x>=viewport.x && nodeBox.x+nodeBox.width<=viewport.x+viewport.width,"新加入的节点应在可视画布内");
  await page.locator(".project-save-state").filter({hasText:/^已保存/}).waitFor();
  const readIssue = () => page.evaluate(async ({workspaceId,id}) => {
    const response = await fetch("/api/workbench/transport?path="+encodeURIComponent("/api/issues/"+id),{
      headers:{"x-workspace-id":workspaceId},
    });
    if (!response.ok) throw Error("读取候选原任务失败 "+response.status);
    return response.json();
  },{workspaceId,id:facts.row.id});
  assert.equal((await readIssue()).project_id,null);
  await page.reload();
  await canvas.locator(".project-node").filter({hasText:facts.row.title}).waitFor();
  await open();
  await search.fill(facts.row.identifier);
  await dialog.locator(".project-candidate-list .team-empty").waitFor();
  await page.keyboard.press("Escape");
  await button("查看变更并发布").click();
  await page.getByRole("dialog").getByRole("button",{name:"发布 V1",exact:true}).click();
  await button("编辑草案").waitFor();
  const included = await readIssue();
  assert.equal(included.id,facts.row.id);
  assert.equal(included.project_id,facts.project.id);
  await page.getByLabel("看板视图").getByRole("button",{name:"全部任务",exact:true}).click();
  await page.getByRole("heading",{name:"全部任务",exact:true}).waitFor();
  console.log("PASS 101 条同前缀候选完整可见，标题和部分编号筛选、本项目候选与其他项目排除；取消无写入，加入后定位节点、刷新去重，发布 V1 才关联原任务 ID");
}
