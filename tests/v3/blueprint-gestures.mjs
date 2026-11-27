import assert from "node:assert/strict";

export async function verifyCanvasGestures(page) {
  const button = name => page.getByRole("button",{name,exact:true});
  const canvas = page.locator(".project-canvas");
  const nodes = canvas.locator(".project-node");
  const position = node => node.evaluate(el => [el.style.left,el.style.top]);
  await button("适应画布").click();
  await canvas.scrollIntoViewIfNeeded();
  const first = nodes.nth(0);
  const second = nodes.nth(1);
  const original = await position(first);
  const readDraft = () => page.evaluate(async () => {
    const route = path => "/api/workbench/transport?path=" + encodeURIComponent("/api" + path);
    const url = new URL(location.hash.slice(1),location.origin);
    const spaces = await (await fetch(route("/workspaces"))).json();
    const workspace = spaces.find(row => row.slug === url.pathname.split("/team/")[1].split("/")[0]);
    const response = await fetch(route("/projects/"+url.searchParams.get("project")+"/blueprint/draft"),{
      headers:{"x-workspace-id":workspace.id},
    });
    if (!response.ok) throw Error("读取草案失败 " + response.status);
    return (await response.json()).draft;
  });
  const before = await readDraft();
  const xy = await first.boundingBox();
  const x = Math.round(xy.x + xy.width / 2);
  const y = Math.round(xy.y + xy.height / 2);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:2});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+35,y:y+25}]});
    assert.notDeepEqual(await position(first),original,"拖动过程中应预览新位置");
    assert.match(await page.locator(".project-save-state").innerText(),/^已保存/);
    const during = await readDraft();
    assert.equal(during.revision,before.revision);
    assert.deepEqual(during.graph,before.graph);
    await cdp.send("Input.dispatchTouchEvent",{type:"touchCancel",touchPoints:[]});
    assert.deepEqual(await position(first),original,"系统取消指针后应恢复节点位置");
  } finally {
    await cdp.send("Emulation.setTouchEmulationEnabled",{enabled:false});
    await cdp.detach();
  }
  await page.mouse.move(x,y);
  await page.mouse.down({button:"right"});
  await page.mouse.move(x+30,y+20,{steps:4});
  await page.mouse.up({button:"right"});
  await page.keyboard.press("Escape");
  assert.deepEqual(await position(first),original,"右键移动不应拖动节点");
  await first.click();
  await second.click({modifiers:["Shift"]});
  assert.equal(await canvas.locator(".project-node.selected").count(),2);
  const previewScope = async () => {
    await button("用 AI 调整蓝图").click();
    const dialog = page.getByRole("dialog",{name:"用 AI 调整蓝图"});
    const response = page.waitForResponse(res =>
      res.request().method()==="POST" && new URL(res.url()).searchParams.get("path")?.endsWith("/planning-requests")
      && res.request().postDataJSON()?.preview===true);
    await dialog.getByRole("button",{name:"查看本次发送的输入"}).click();
    const receipt = await response;
    assert.equal(receipt.status(),200);
    await dialog.locator(".project-input-preview").waitFor();
    await page.keyboard.press("Escape");
    return receipt.json();
  };
  const selection = await previewScope();
  assert.equal(selection.scope,"selected");
  assert.deepEqual(selection.selected_nodes,before.graph.nodes.slice(0,2).map(n => n.id));
  await second.click({modifiers:["Shift"]});
  assert.equal(await canvas.locator(".project-node.selected").count(),1);
  assert.match(await first.getAttribute("class"),/\bselected\b/);
  const dependency = before.graph.edges[0];
  const nodeTitle = id => before.graph.nodes.find(n => n.id===id).title;
  const edge = canvas.getByRole("button",{name:nodeTitle(dependency.from)+" → "+nodeTitle(dependency.to),exact:true});
  for (const key of ["Enter","Space"]) {
    await edge.press(key);
    assert.equal(await page.getByRole("textbox",{name:"下游需要什么"}).inputValue(),dependency.handoff ?? "");
    assert.equal(await canvas.locator(".project-node.selected").count(),0);
    if (key==="Enter") await first.press("Enter");
  }
  const noNodes = await previewScope();
  assert.equal(noNodes.scope,"add");
  assert.equal(noNodes.selected_nodes?.length ?? 0,0);
  await canvas.click({position:{x:3,y:3}});
  assert.equal(await canvas.locator(".project-node.selected").count(),0);
  await page.locator(".project-inspector-empty").waitFor();
  const cancelled = await readDraft();
  assert.equal(cancelled.revision,before.revision);
  assert.deepEqual(cancelled.graph,before.graph);
  const saved = () => page.waitForResponse(response => {
    const target = new URL(response.url());
    return response.request().method()==="POST" && target.searchParams.get("path")?.endsWith("/blueprint/draft")
      && response.request().postDataJSON()?.graph;
  });
  await first.scrollIntoViewIfNeeded();
  const tile = await first.boundingBox();
  const px = Math.round(tile.x + tile.width / 2), py = Math.round(tile.y + tile.height / 2);
  const commit = saved();
  await page.mouse.move(px,py);
  await page.mouse.down();
  await page.mouse.move(px+25,py+18,{steps:4});
  await page.mouse.up();
  assert.equal((await commit).status(),200);
  const moved = await readDraft();
  assert.ok(moved.revision > before.revision);
  assert.notDeepEqual(moved.graph.nodes[0].position,before.graph.nodes[0].position);
  assert.deepEqual(moved.graph.edges,before.graph.edges);
  const undo = saved();
  await button("撤销").click();
  assert.equal((await undo).status(),200);
  assert.deepEqual((await readDraft()).graph,before.graph);
  await page.reload();
  await first.waitFor();
  assert.deepEqual(await position(first),original,"刷新后应读到取消前的位置");
  console.log("PASS Enter 和空格定位依赖与下游交接说明；多选的两个节点按 ID 进入规划输入预览，改选连线后旧选区清空");
  console.log("PASS 系统取消触摸拖动与右键移动均未改写节点，Shift 增减选择、点击空白清空检查器，取消保留服务端版本，正常拖动和撤销取得回执并刷新恢复原图");
}
