import assert from "node:assert/strict";

export async function verifyBlueprintRefresh(page) {
  const button = name => page.getByRole("button", {name, exact:true});
  const title = page.getByRole("textbox", {name:"任务标题"});
  const upstream = page.locator(".project-node").filter({hasText:"复核回归清单"});
  const downstream = page.locator(".project-node").filter({hasText:"等候键盘交接"});
  const edge = page.locator(".project-edges .edge-line");
  const isDraft = url => url.pathname === "/api/workbench/transport" &&
    url.searchParams.get("path")?.endsWith("/blueprint/draft");
  await button("编辑草案").click();
  await button("新增任务").click();
  await title.fill("等候键盘交接");
  const handle = upstream.getByRole("button", {name:"连接下游任务"});
  await handle.press("Enter");
  await page.locator(".project-notice").getByRole("button", {name:"取消"}).click();
  assert.equal(await edge.count(), 0);
  await handle.press("Enter");
  await downstream.press("Enter");
  await edge.waitFor({state:"attached"});
  await page.locator(".project-save-state").filter({hasText:/^已保存/}).waitFor();
  await downstream.press("Enter");
  const requirements = page.getByRole("textbox", {name:"交付要求"});
  const draftNote = "核对切换历史时尚未保存的修改";
  const savedNote = page.waitForResponse(response => {
    if (!isDraft(new URL(response.url()))) return false;
    const payload = response.request().postDataJSON();
    return payload?.graph?.nodes.some(node => node.requirements === draftNote);
  });
  await requirements.fill(draftNote);
  await handle.press("Enter");
  await button("版本历史").click();
  await page.getByRole("dialog",{name:"版本历史"}).getByRole("button",{name:"查看此版"}).click();
  await button("返回当前计划").waitFor();
  assert.equal(await downstream.count(),0);
  assert.equal(await page.locator(".project-notice").filter({hasText:"取消"}).count(),0);
  await upstream.press("Enter");
  assert.ok(await title.isDisabled());
  assert.equal(await edge.count(),0);
  assert.equal(await button("新增任务").count(),0);
  assert.equal((await savedNote).status(),200);
  await button("返回当前计划").click();
  await downstream.waitFor();
  assert.equal(await edge.count(),1);
  await page.reload();
  await downstream.waitFor();
  assert.equal(await edge.count(),1);
  await downstream.press("Enter");
  assert.equal(await requirements.inputValue(),draftNote);
  console.log("PASS 连线中查看 V1 即清除待连线状态，历史标题只读且不含拟新增节点，返回与刷新后当前草案依赖保留");
  await upstream.press("Enter");
  let release;
  const held = new Promise(done => {release = done;});
  let numberOfRefreshes = 0;
  // Let the real server write the revision, then delay only the delivery of its reply.
  const intercept = async route => {
    const request = route.request();
    if (request.postDataJSON()?.refresh_baseline !== true) return route.continue();
    numberOfRefreshes++;
    const reply = await route.fetch();
    try {
      assert.equal(reply.status(), 200);
      await held;
      await route.fulfill({response:reply});
    } finally {
      await reply.dispose();
    }
  };
  await page.route(isDraft, intercept);
  try {
    const sync = button("同步任务最新内容");
    page.once("dialog", dialog => dialog.dismiss());
    await sync.click();
    assert.equal(numberOfRefreshes, 0);
    const request = page.waitForRequest(req => isDraft(new URL(req.url())) && req.postDataJSON()?.refresh_baseline === true);
    page.once("dialog", dialog => dialog.accept());
    await sync.click();
    await request;
    const revisedTitle = "同步期间编辑的草案标题";
    await title.fill(revisedTitle);
    const persisted = page.waitForResponse(res => {
      if (!isDraft(new URL(res.url()))) return false;
      const body = res.request().postDataJSON();
      return body?.refresh_baseline === false && body.graph.nodes.some(n => n.title === revisedTitle);
    });
    release();
    assert.equal((await persisted).status(), 200);
    await page.locator(".project-save-state").filter({hasText:/^已保存/}).waitFor();
    await page.reload();
    await page.locator(".project-node").filter({hasText:revisedTitle}).waitFor();
    await downstream.waitFor();
    assert.equal(await edge.count(), 1);
    assert.equal(numberOfRefreshes, 1);
  } finally {
    release();
    await page.unroute(isDraft, intercept);
  }
  console.log("PASS 蓝图键盘连接下游、取消连接和同步、延迟真实同步回执保留输入，刷新恢复两节点与前置依赖");
}

export async function verifyHistoricalTaskMembership(page) {
  // This workspace was created by this replay. Change two of its real tasks
  // while retaining V1, then revisit that version through the project UI.
  const facts = await page.evaluate(async () => {
    const url = path => "/api/workbench/transport?path=" + encodeURIComponent("/api" + path);
    const spaces = await (await fetch(url("/workspaces"))).json();
    const slug = location.hash.split("/team/")[1].split(/[/?]/)[0];
    const space = spaces.find(row => row.slug === slug);
    async function request(path, method = "GET", body) {
      const headers = {"content-type":"application/json","x-workspace-id":space.id};
      const tunnel = method === "PUT" || method === "DELETE";
      if (tunnel) headers["x-workbench-method"] = method;
      const response = await fetch(url(path), {
        method:tunnel ? "POST" : method, headers,
        body:JSON.stringify(body),
      });
      if (!response.ok) throw Error(method + " " + path + " failed " + response.status);
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }
    const {projects} = await request("/projects");
    const original = projects.find(project => project.title === "移动端弱网上传");
    const destination = projects.find(project => project.title === "新版发布准备");
    const path = "/projects/" + original.id;
    const [{graph}] = (await request(path + "/blueprint/versions")).versions;
    const before = await request(path + "/start-tasks");
    const [moved, removed] = before.items;
    const stillHere = graph.nodes.find(node => node.issue_id !== moved.issue_id && node.issue_id !== removed.issue_id);
    const issuePath = "/issues/" + moved.issue_id;
    const {revision} = await request(issuePath);
    await request(issuePath,"PUT",{expected_revision:revision,project_id:destination.id,suppress_run:true});
    await request("/issues/" + removed.issue_id,"DELETE");
    const remaining = (await request(path + "/start-tasks")).items.map(item => item.issue_id);
    const result = await request(path + "/start-tasks","POST",{
      request_id:crypto.randomUUID(), version:before.version, items:[moved,removed],
    });
    return {
      names:[moved.title,removed.title], ids:[moved.issue_id,removed.issue_id],
      live:stillHere.title, remaining, receipts:result.items.map(item => item.status),
      movedToDestination:(await request(issuePath)).project_id === destination.id,
    };
  });
  assert.ok(facts.movedToDestination);
  assert.ok(facts.ids.every(id => !facts.remaining.includes(id)));
  assert.deepEqual(facts.receipts,["failed","failed"]);
  await page.getByLabel("看板视图").getByRole("button",{name:"全部项目",exact:true}).click();
  await page.getByRole("heading",{name:"移动端弱网上传",exact:true}).click();
  await page.getByRole("button",{name:"施工蓝图",exact:true}).click();
  await page.getByRole("button",{name:"版本历史",exact:true}).click();
  await page.getByRole("dialog",{name:"版本历史"}).getByRole("button",{name:"查看此版"}).click();
  const inspector = page.locator(".project-inspector");
  const open = inspector.locator(".project-inspector-title").getByRole("button");
  for (const name of [...facts.names,facts.live]) {
    await page.locator(".project-node").filter({has:page.getByText(name,{exact:true})}).press("Enter");
    assert.equal(await inspector.getByRole("textbox",{name:"任务标题"}).inputValue(),name);
    assert.equal(await open.count(), name === facts.live ? 1 : 0);
  }
  console.log("PASS 移走与删除真实任务后 V1 保留原节点，只有仍归属本项目的任务可打开，重放原交接输入均收到失败回执");
}
