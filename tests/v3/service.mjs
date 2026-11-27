// Run against a dedicated local lab. Every execution uses a new tenant and accounts.
import { labSql } from "./lab-sql.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.MW_V3_API || "http://127.0.0.1:19115";
const stamp = randomUUID().slice(0, 8);
const password = randomUUID();
async function call(account, path, body, options = {}) {
  const response = await fetch(base + path, {
    method: options.method || (body === undefined ? "GET" : "POST"),
    headers: {
      "content-type": "application/json",
      ...(account && { authorization: "Bearer " + account.token }),
      ...(options.ws && { "x-workspace-id": options.ws }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  if (options.denied) {
    assert.ok(
      options.denied.includes(response.status),
      path + " unexpected HTTP " + response.status,
    );
    return;
  }
  assert.ok(
    response.ok,
    path + " HTTP " + response.status + " " + raw.slice(0, 250),
  );
  return (
    raw &&
    (response.headers.get("content-type")?.includes("json")
      ? JSON.parse(raw)
      : raw)
  );
}
const accounts = [];
for (const role of ["a", "b", "c", "d"]) {
  accounts.push(
    await call(null, "/auth/password/register", {
      username: "mw" + role + stamp,
      password,
    }),
  );
}
const [a, b, c, outsider] = accounts;
const workspace = await call(a, "/api/workspaces", {
  name: "空团队 " + stamp,
  slug: "v3-" + stamp,
});
const ws = workspace.id;
assert.ok(ws);
const api = (who, path, body, options) =>
  call(who, "/api" + path, body, { ws, ...options });
async function invite(who) {
  const invitation = await api(a, "/workspaces/" + ws + "/members", {
    email: who.user.email,
    role: "member",
  });
  await api(
    outsider,
    "/invitations/" + invitation.id + "/accept",
    {},
    { denied: [403, 404] },
  );
  await api(who, "/invitations/" + invitation.id + "/accept", {});
}
await invite(b);
await invite(c);
const navigation=who=>api(who,"/workbench/navigation");
assert.deepEqual(await navigation(b),[]);
await api(outsider,"/workbench/navigation",undefined,{denied:[403,404]});
assert.equal((await api(a, "/projects")).projects.length, 0);
assert.equal((await api(a, "/issues")).total, 0);
console.log("PASS 空团队、定向邀请、三身份入队和错误身份拒绝");
await api(
  b,
  "/workspaces/" + ws,
  { name: "非法修改" },
  { method: "PATCH", denied: [403, 404] },
);
await api(
  a,
  "/workspaces/" + ws,
  { context: "长".repeat(2001) },
  { method: "PATCH", denied: [400] },
);
const qoder = await api(a, "/workspaces/" + ws + "/qoder");
assert.equal(qoder.available, true);
assert.equal(qoder.configured, false);
await api(b, "/workspaces/" + ws + "/qoder/stop", {}, { denied: [403, 404] });
console.log(
  "PASS 空间资料角色与字段边界、云运行时加密服务可用、普通成员不能管理连接",
);
const project = await api(a, "/projects", {
  title: "弱网上传",
  description: "每个请求仅交付一次",
});
const route = "/projects/" + project.id;
await api(a, "/projects", { title: " 弱网上传 " }, { denied: [409] });
await api(
  a,
  route,
  { due_date: "2026-01-03", start_date: "2026-02-01" },
  { method: "PUT", denied: [400, 422] },
);
await api(outsider, route, undefined, { denied: [403, 404] });
const { draft } = await api(a, route + "/blueprint/draft", {});
const node = (title, x) => ({
  id: randomUUID(),
  title,
  position: { x, y: 80 },
  assignee_type: "member",
  assignee_id: b.user.id,
  requirements: "交付可复查的记录",
});
const first = node("确定复现条件", 80),
  second = node("验证上传去重", 480);
const edge = {
  id: randomUUID(),
  from: first.id,
  to: second.id,
  handoff: "复现条件",
};
const graph = { schema_version: 1, nodes: [first, second], edges: [edge] };
const save = (graph, revision = draft.revision, options = {}) =>
  api(
    a,
    route + "/blueprint/draft",
    { graph, expected_revision: revision },
    { method: "PUT", ...options },
  );
const publish = (path, draft, request_id, options) =>
  api(
    a,
    route + "/blueprint/" + path,
    {
      request_id,
      expected_revision: draft.revision,
      base_version: draft.base_version,
    },
    options,
  );
await publish("publish", draft, randomUUID(), { denied: [422] });
for (const bad of [
  { ...edge, to: first.id },
  { ...edge, to: randomUUID() },
  { ...edge, from: second.id, to: first.id },
  edge,
]) {
  await save(
    { ...graph, edges: [edge, { ...bad, id: randomUUID() }] },
    draft.revision,
    { denied: [422] },
  );
}
const saved = (await save(graph)).draft;
await save(graph, draft.revision, { denied: [409] });
await publish("publish-preview", saved, randomUUID());
assert.equal((await api(a, "/issues")).total, 0);
const key = randomUUID();
const [v1, replay] = await Promise.all([
  publish("publish", saved, key),
  publish("publish", saved, key),
]);
assert.equal(v1.id, replay.id);
await publish("publish", saved, randomUUID(), { denied: [409] });
assert.equal((await api(a, "/issues")).total, 2);
assert.equal((await api(a, route + "/blueprint/versions")).versions.length, 1);
console.log("PASS 拟新增、发布预览、非法边、过期草案、并发发布、重复请求");
const candidates = () => api(a, route + "/start-tasks");
const items = (await candidates()).items;
const up = items.find((i) => i.title === first.title),
  down = items.find((i) => i.title === second.title);
assert.ok(up && !up.reason);
assert.match(down.reason, /前置/);
const handoff = (item, request_id = randomUUID()) =>
  api(a, route + "/start-tasks", { version: 1, items: [item], request_id });
assert.equal((await handoff(down)).items[0].status, "failed");
const handoffKey = randomUUID();
const receipt = (await handoff(up, handoffKey)).items[0];
assert.equal(receipt.status, "notified");
assert.deepEqual((await handoff(up, handoffKey)).items[0], receipt);
assert.equal((await api(b, "/issues/" + up.issue_id)).status, "backlog");
const inbox = await api(b, "/inbox");
assert.ok(inbox.some((x) => x.issue_id === up.issue_id));
await api(b, "/issues/" + up.issue_id, { status: "done" }, { method: "PUT" });
assert.ok(
  !(await candidates()).items.find((i) => i.issue_id === down.issue_id).reason,
);
console.log(
  "PASS 不满足前置被拒、站内收件箱送达、重复交接不改状态、上游完成后解锁",
);
const rooms = "/workbench/rooms";
const room = await api(a, rooms, {
  kind: "direct",
  title: "灰度私聊 " + stamp,
  members: [b.user.id],
  project_id: project.id,
});
const bytes = Buffer.from("仅参与者可下载" + stamp);
const post = {
  request_id: randomUUID(),
  content: "回归材料 " + stamp,
  filename: "复现.txt",
  bytes: bytes.toString("base64"),
};
const message = await api(b, rooms + "/" + room.id + "/messages", post);
const roomLookup=rooms+"/"+room.id+"/search?q="+encodeURIComponent(post.content);
assert.ok((await api(a,roomLookup)).some(hit=>hit.kind==="message" && hit.id===message.id));
await api(c,roomLookup,undefined,{denied:[404]});
await api(outsider,roomLookup,undefined,{denied:[403,404]});
assert.deepEqual(await api(b,rooms+"/"+room.id+"/search?q=no-match-"+stamp),[]);

assert.equal(
  (await api(b, rooms + "/" + room.id + "/messages", post)).id,
  message.id,
);
assert.equal((await api(b, rooms + "/" + room.id)).messages.length, 1);
const file = "/workbench/room-files/" + message.id;
assert.equal(await api(b, file), bytes.toString());
await api(c, file, undefined, { denied: [404] });
await api(c, rooms + "/" + room.id, undefined, { denied: [404] });
assert.equal((await api(c, rooms + "?q=" + stamp)).length, 0);
const withFiles={request_id:randomUUID(),content:"",files:["甲","","乙"].map(v=>({filename:"同名文件.txt",bytes:Buffer.from(v).toString("base64")}))};
const attachmentsRoute=rooms+"/"+room.id+"/messages";
const [f1,f2]=await Promise.all([api(b,attachmentsRoute,withFiles),api(b,attachmentsRoute,withFiles)]);
assert.equal(f1.id,f2.id);
await api(b,attachmentsRoute,{...withFiles,files:withFiles.files.slice(0,2)},{denied:[409]});
await api(b,attachmentsRoute,{...withFiles,files:[...withFiles.files,...withFiles.files]},{denied:[422]});
const shared=(await api(a,rooms+"/"+room.id)).messages.find(m=>m.id===f1.id);
assert.equal(new Set(shared.files.map(f=>f.id)).size,3);
const myFiles=await api(a,"/workbench/files");
for(const [i,attachment] of shared.files.entries()){
  const entry=myFiles.find(f=>f.id===attachment.id);
  assert.equal(entry?.message_id,f1.id);assert.equal(entry.downloadable,true);
  const url="/workbench/room-files/"+attachment.id;
  assert.equal(await api(a,url),["甲","","乙"][i]);
  await api(c,url,undefined,{denied:[404]});
}
assert.ok(!(await api(c,"/workbench/files")).some(f=>shared.files.some(s=>s.id===f.id)));
console.log("PASS 多附件同一消息事务、双发唯一回执、请求改内容拒绝、顺序与零字节、文件来源及第三身份隔离");
const convert = "/workbench/room-messages/" + message.id + "/task";
const spec = { title: "可共享的验收任务", request_id: randomUUID() };
const [task, again] = await Promise.all([
  api(a, convert, spec),
  api(a, convert, spec),
]);
assert.equal(task.id, again.id);
assert.equal((await api(c, "/issues/" + task.id)).title, spec.title);
const source = "/workbench/issue-source/" + task.id;
const bNav=await navigation(b);
assert.ok(bNav.find(i=>i.id===task.id && i.related));
assert.equal(bNav.find(i=>i.id===room.id).project_id,project.id);
assert.ok(!(await navigation(c)).some(i=>i.id===room.id || i.title===room.title));
assert.equal((await api(a, source)).source.id, room.id);
assert.deepEqual(await api(c, source), { source: null });
await api(outsider, source, undefined, { denied: [403, 404] });
await api(c, convert, spec, { denied: [403, 404] });
console.log(
  "PASS 私聊读取、检索、附件字节、消息与转任务幂等、跨团队和来源授权",
);
const { draft: next } = await api(a, route + "/blueprint/draft", {});
const reduced = {
  ...next.graph,
  nodes: next.graph.nodes.slice(0, 1),
  edges: [],
};
const saved2 = (await save(reduced, next.revision)).draft;
await publish("publish", saved2, randomUUID());
assert.equal((await api(a, "/issues/" + down.issue_id)).project_id, project.id);
await api(a, route, undefined, { method: "DELETE" });
assert.equal((await api(c, "/issues/" + task.id)).project_id, null);
assert.equal((await api(b, "/issues/" + down.issue_id)).project_id, null);
assert.equal((await api(a, rooms + "/" + room.id)).project_id, null);
assert.equal((await api(a, source)).source.id, room.id);
console.log("PASS 移出蓝图保留任务、删除项目解除任务与会话归属、来源继续可见");

const files = (who) => api(who, "/workbench/files");
assert.ok((await files(a)).some((f) => f.id === message.id));
assert.ok(!(await files(c)).some((f) => f.id === message.id));
const links = "/workbench/join-links";
await api(b, links, {}, { denied: [403, 404] });
const link = await api(a, links, {});
const acceptLink = (accept, options = {}) =>
  call(
    outsider,
    "/api/invitations/join-link",
    { token: link.token, accept },
    options,
  );
assert.equal((await acceptLink(false)).member, false);
await api(a, links + "/" + link.id, { enabled: false }, { method: "PUT" });
await acceptLink(true, { denied: [404] });
await api(a, links + "/" + link.id, { enabled: true }, { method: "PUT" });
for (let i = 0; i < 2; i++) assert.equal((await acceptLink(true)).member, true);
assert.equal(
  (await api(a, "/workspaces/" + ws + "/members")).filter(
    (m) => m.user_id === outsider.user.id,
  ).length,
  1,
);
labSql(
  "UPDATE workspace_join_link SET expires_at=now()-interval '1 minute' WHERE id=:'id'",
  { id: link.id },
);
await acceptLink(true, { denied: [404] });
await api(a, links + "/" + link.id, undefined, { method: "DELETE" });
await acceptLink(true, { denied: [404] });
console.log("PASS 文件聚合隔离，通用邀请启停、成员去重和删除");

const work = await api(a, "/workbench");
assert.ok(work.mock, "本套验证需要显式 MOBILEWORK_WORK_ADAPTER=mock");
const side = { kind: "room", id: room.id, prompt: "复述可见材料" };
const before = await api(a, rooms + "/" + room.id);
assert.match((await api(a, "/workbench/side-work", side)).answer, /回归材料/);
const followup = {...side, prompt:"沿用刚才的约定", history:[{question:"侧聊独有代号",answer:"青松检查点"}]};
assert.match((await api(a,"/workbench/side-work",followup)).answer,/青松检查点/);
assert.doesNotMatch((await api(a,"/workbench/side-work",side)).answer,/青松检查点/);
await api(a,"/workbench/side-work",{...followup,history:Array(9).fill(followup.history[0])},{denied:[422]});
await api(c, "/workbench/side-work", followup, { denied: [404] });
const sideProject = await api(a,"/projects",{title:"临时范围"+stamp,description:"旁注项目交付规则"});
const attached = {filename:"临时口令.txt",bytes:Buffer.from("枫树样例").toString("base64")};
const temporary = {...side,prompt:"",project_id:sideProject.id,permission:"full",files:[attached]};
const listingBeforeSide = await api(a,"/workbench/files");
const attachmentAnswer=await api(a,"/workbench/side-work",temporary);
for (const fragment of ["枫树样例","旁注项目交付规则","临时口令.txt"]) assert.ok(attachmentAnswer.answer.includes(fragment));
assert.deepEqual(await api(a,"/workbench/files"),listingBeforeSide);
await api(a,"/workbench/side-work",{...temporary,files:Array(5).fill(attached)},{denied:[422]});
await api(a,"/workbench/side-work",{...temporary,permission:"unexpected"},{denied:[422]});
await api(c,"/workbench/side-work",temporary,{denied:[404]});
const privateScope=await call(outsider,"/api/workspaces",{name:"侧聊隔离"+stamp,slug:"side-"+stamp});
const otherProject=await call(outsider,"/api/projects",{title:"另一个团队项目"},{ws:privateScope.id});
await api(a,"/workbench/side-work",{...temporary,project_id:otherProject.id},{denied:[404]});
await api(a,"/projects/"+sideProject.id,undefined,{method:"DELETE"});
await api(a,"/workbench/side-work",temporary,{denied:[404]});
console.log("PASS 临时侧聊仅读取有权项目与本次附件，后台验证选择、上限及撤权，附件与会话均未进入共享记录");
assert.deepEqual(await api(a, rooms + "/" + room.id), before);
assert.equal(
  (await api(a, "/workbench")).conversations.length,
  work.conversations.length,
);
async function waitResult(load, done) {
  for (let i = 0; i < 65; i++) {
    const result = await load();
    if (done(result)) return result;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.fail("后台工作未在测试窗口内完成");
}
const group = await api(a, rooms, {
  kind: "group",
  title: "三人群聊",
  members: [b.user.id, c.user.id],
});
await api(c, rooms + "/" + group.id + "/messages", {
  request_id: randomUUID(),
  content: "本次验收编号 " + stamp,
});
const groupFileMessage=await api(a,rooms+"/"+group.id+"/messages",{...withFiles,request_id:randomUUID()});
const groupFile=(await api(c,rooms+"/"+group.id)).messages.find(m=>m.id===groupFileMessage.id).files[2].id;
assert.equal(await api(c,"/workbench/room-files/"+groupFile),"乙");
const mentioned = { request_id: randomUUID(), content: "@Work 整理讨论" };
const mention = await api(a, rooms + "/" + group.id + "/messages", mentioned);
assert.equal(
  (await api(a, rooms + "/" + group.id + "/messages", mentioned)).id,
  mention.id,
);
const groupDone = await waitResult(
  () => api(b, rooms + "/" + group.id),
  (r) => r.messages.find(m=>m.id===mention.id)?.work?.status === "completed",
);
assert.match(groupDone.messages.find(m=>m.id===mention.id).work.answer, new RegExp(stamp));
assert.equal(groupDone.messages[0].work, null);
const conversation = await api(a, "/workbench/conversations", {
  title: "验收",
});
async function ask(prompt) {
  const req = {
    prompt,
    conversationId: conversation.id,
    requestId: randomUUID(),
  };
  await api(a, "/workbench/messages", req);
  const result = await waitResult(
    () => api(a, "/workbench/messages/" + req.requestId),
    (r) => r.status !== "running",
  );
  assert.equal((await api(a, "/workbench/messages", req)).id, result.id);
  return result;
}
await api(
  a,
  "/workbench/messages",
  {
    requestId: randomUUID(),
    conversationId: conversation.id,
    prompt: "x",
    modelId: "override",
  },
  { denied: [422] },
);
const failed = await ask("【模拟失败】汇总任务");
assert.equal(failed.status, "failed");
assert.ok(!(await files(a)).some((f) => f.id === failed.id));
const okWork = await ask("汇总任务");
assert.equal(okWork.status, "completed");
assert.ok((await files(a)).some((f) => f.id === okWork.id));
assert.match(
  await api(a, "/workbench/artifacts/" + okWork.id),
  /可共享的验收任务/,
);
await api(b, "/workbench/artifacts/" + okWork.id, undefined, { denied: [404] });
assert.ok(!(await files(b)).some((f) => f.id === okWork.id));
console.log(
  "PASS Mock Work 成败、重发幂等、群内提及、权限过滤、临时侧聊清空与持久产物",
);

const samples = [];
for (let i = 0; i < 2; i++) {
  const sample = await call(a, "/api/workspaces", {
    name: "演示",
    slug: "demo-" + stamp + "-" + i,
    demo: true,
  });
  const query = (path, body, options) =>
    call(a, "/api" + path, body, { ws: sample.id, ...options });
  const seedIssues=(await query("/issues")).issues;
  assert.deepEqual(seedIssues.map(issue=>issue.identifier).sort(),[101,102,103,104,105,106,107,108,109,111].map(n=>"ANDR-"+n));
  assert.equal(seedIssues.find(issue=>issue.title==="实现上传重试去重").identifier,"ANDR-102");
  assert.equal(labSql("SELECT issue_counter FROM workspace WHERE id=:'id'",{id:sample.id}),"111");
  const pinnedTask=seedIssues.find(issue=>issue.identifier==="ANDR-105");
  assert.ok((await query("/pins")).some(pin=>pin.item_type==="issue" && pin.item_id===pinnedTask.id));
  for (const number of [101,111]) {
    const issue=seedIssues.find(row=>row.identifier==="ANDR-"+number);
    assert.ok((await query("/issues/"+issue.id+"/subscribers")).some(row=>row.user_id===a.user.id));
  }
  const sampleNav=await query("/workbench/navigation");
  const sampleRoom=sampleNav.find(i=>i.title==="弱网上传交付协作");
  assert.deepEqual([sampleRoom.unread,sampleRoom.tag],[2,"@"]);
  assert.equal(sampleNav.filter(i=>i.kind==="room")[0].id,sampleRoom.id);
  assert.equal(sampleNav.filter(i=>i.project_id===sampleRoom.project_id).reduce((sum,i)=>sum+i.unread,0),3);
  const list = (await query("/projects")).projects;
  assert.equal(list.length, 3);
  assert.equal(
    labSql(
      "SELECT count(*) FROM archived_issue WHERE workspace_id=:'id' AND title='已归档的旧排查记录'",
      { id: sample.id },
    ),
    "1",
  );
  assert.ok(
    !(await query("/issues")).issues.some(
      (i) => i.title === "已归档的旧排查记录",
    ),
  );
  const release = list.find((p) => p.title === "新版发布准备");
  const draft = (
    await query("/projects/" + release.id + "/blueprint/draft", {})
  ).draft;
  assert.equal(draft.graph.nodes.length, 2);
  assert.equal(draft.graph.edges.length, 1);
  const p = list.find((p) => p.title === "移动端弱网上传");
  const start = "/projects/" + p.id + "/start-tasks";
  const candidates = (await query(start)).items;
  const agent = candidates.find((i) => i.assignee_type === "agent");
  assert.ok(agent && !agent.reason);
  const body = { version: 1, items: [agent], request_id: randomUUID() };
  const response = (await query(start, body)).items[0];
  assert.ok(["queued", "failed"].includes(response.status));
  assert.deepEqual((await query(start, body)).items[0], response);
  if (response.status === "queued")
    assert.match(response.task_id, /^[a-f0-9-]{36}$/);
  assert.equal(response.status, "failed", "种子智能体没有绑定运行时");
  const runtime = labSql(
    `INSERT INTO agent_runtime(workspace_id,name,runtime_mode,provider,status,visibility,owner_id)
    VALUES(:'ws','离线验收端','local','codex','offline','private',:'owner') RETURNING id`,
    { ws: sample.id, owner: a.user.id },
  );
  await query(
    "/agents/" + agent.assignee_id,
    { runtime_id: runtime },
    { method: "PUT" },
  );
  const recovered = (await query(start, { ...body, request_id: randomUUID() }))
    .items[0];
  assert.equal(recovered.status, "queued", JSON.stringify(recovered));
  const receipt = (await query("/projects/" + p.id + "/receipts")).find(
    (r) => r.handoff === "queued",
  );
  assert.equal(receipt.execution, "queued");
  assert.equal((await query("/issues/" + agent.issue_id)).status, "todo");
  assert.equal((await query(start, body)).items[0].status, "failed");
  console.log("PASS 派发失败持久化、修复绑定后重试入队、旧请求仍返回原回执");
  console.log("样例智能体交接回执", response.status);
  const table = (field, direction) =>
    query("/issues/table/rows", {
      query: { scope: { kind: "workspace" }, sort: { field, direction } },
      group: { kind: "none" },
      page: { limit: 100 },
    });
  for (const col of [
    "title",
    "status",
    "priority",
    "assignee",
    "project",
    "start_date",
    "due_date",
  ]) {
    const asc = await table(col, "asc"),
      desc = await table(col, "desc");
    assert.equal(asc.total, desc.total);
    assert.ok(asc.total >= 10);
    if (col === "title")
      assert.deepEqual(
        asc.rows.map((r) => r.issue.id),
        desc.rows.map((r) => r.issue.id).reverse(),
      );
  }
  const nextExample=await query("/issues",{title:"验收样例后续编号",status:"todo",suppress_run:true});
  assert.equal(nextExample.identifier,"ANDR-112");
  assert.equal((await query("/issues/"+nextExample.id)).identifier,nextExample.identifier);
  await call(a,"/api/issues/"+nextExample.id,undefined,{ws:sample.id,method:"DELETE"});
  samples.push({ ws: sample.id, project: p.id });
}
assert.notEqual(samples[0].ws, samples[1].ws);
await call(a, "/api/projects/" + samples[0].project, undefined, {
  ws: samples[1].ws,
  denied: [404, 403],
});
console.log("PASS 两份独立种子、发布前节点、交接重放及七列表格升降序");

const view = "/workbench/pins";
const pin = await api(a, view, { messageId: okWork.id });
assert.equal((await api(a, view + "/" + pin.id + "/versions"))[0].revision, 1);
await api(a, view + "/" + pin.id + "/refresh?force=1", {});
const versions = await waitResult(
  () => api(a, view + "/" + pin.id + "/versions"),
  (r) => r.length === 2,
);
assert.equal(versions[0].revision, 2);
assert.equal((await api(b, view + "/" + pin.id + "/versions")).length, 0);
await api(a, view + "/" + pin.id, undefined, { method: "DELETE" });
assert.equal((await api(a, view + "/" + pin.id + "/versions")).length, 0);
assert.equal(
  (await api(a, "/workbench/messages/" + okWork.id)).status,
  "completed",
);
const card = await ask("请告诉我在哪邀请成员？");
assert.equal(card.result.action, "invite");
const createTask = await ask("请创建任务");
const confirm = "/workbench/messages/" + createTask.id + "/task";
await api(b, confirm, { title: "无权限" }, { denied: [404] });
const [t1, t2] = await Promise.all([
  api(a, confirm, { title: "Work 确认任务" }),
  api(a, confirm, { title: "Work 确认任务" }),
]);
assert.equal(t1.id, t2.id);
assert.equal(
  (await api(a, "/workbench/issue-source/" + t1.id)).source.kind,
  "work",
);
assert.deepEqual(
  (await api(b, "/workbench/issue-source/" + t1.id)).source,
  null,
);
const prefs = "/workbench/preferences";
const original = await api(a, prefs);
const savedPrefs = await api(
  a,
  prefs,
  { ...original, theme: "dark", chat_size: 18, instructions: stamp },
  { method: "PUT" },
);
assert.equal(savedPrefs.version, original.version + 1);
assert.equal((await api(a, prefs)).chat_size, 18);
assert.notEqual((await api(b, prefs)).instructions, stamp);
await api(a, prefs, original, { method: "PUT", denied: [409] });
await api(
  a,
  prefs,
  { ...savedPrefs, chat_size: 90 },
  { method: "PUT", denied: [422] },
);
console.log(
  "PASS 知识入口、确认任务与私有来源、视图版本与取消固定、设置版本和隔离",
);

const sample = samples[0],
  suggest = (body, options) =>
    call(a, "/api/workbench/suggestions", body, { ws: sample.ws, ...options });
const offer = await suggest({ action: "check" });
assert.ok(offer.id && offer.reason);
assert.deepEqual(await suggest({ action: "check" }), {});
await suggest({ action: "snooze", id: offer.id });
labSql(
  "UPDATE work_suggestion SET shown_at=now()-interval '4 minutes' WHERE workspace_id=:'ws'",
  { ws: sample.ws },
);
assert.deepEqual(await suggest({ action: "check" }), {});
await call(
  a,
  "/api/issues/" + offer.id,
  { status: "done" },
  { ws: sample.ws, method: "PUT" },
);
await suggest({ action: "open", id: offer.id }, { denied: [409] });
labSql(
  "UPDATE work_suggestion SET quiet_until=now()-interval '1 minute' WHERE workspace_id=:'ws'",
  { ws: sample.ws },
);
const nextOffer = await suggest({ action: "check" });
assert.notEqual(nextOffer.id, offer.id);
const opened = await suggest({ action: "open", id: nextOffer.id });
assert.ok(
  opened.conversationId &&
    opened.requestId &&
    opened.prompt.includes(nextOffer.title),
);
assert.deepEqual(await suggest({ action: "open", id: nextOffer.id }), opened);
console.log("PASS 建议依据、自动展示间隔、延后、候选失效和重复打开");

const follow = "/workbench/issues/" + t1.id + "/followup";
await api(a, follow, { action: "link", url: "incomplete" }, { denied: [422] });
const ref = await api(a, follow, {
  action: "link",
  url: "https://example.com/acceptance",
  title: "交付证据",
});
assert.equal((await api(a,follow,{action:"link",url:"https://example.com/acceptance"})).id,ref.id);
const [sharedReference] = (await api(b, follow)).links;
assert.equal(sharedReference.id,ref.id);
assert.equal(sharedReference.title,"交付证据");
await api(a, follow, { action: "unlink", id: ref.id });
assert.equal((await api(a, follow)).links.length, 0);
const alarm = {
  action: "schedule",
  id: randomUUID(),
  at: new Date(Date.now() + 45000).toISOString(),
  instruction: "复查交付",
};
await api(
  a,
  follow,
  { ...alarm, at: "2022-01-01T12:00:00Z" },
  { denied: [422] },
);
await api(a, follow, alarm);
await api(a, follow, alarm);
assert.equal((await api(a, follow)).reminders.length, 1);
assert.equal((await api(b, follow)).reminders.length, 0);
await api(a, follow, { action: "pause", id: alarm.id });
assert.equal((await api(a, follow)).reminders[0].status, "paused");
await api(a, follow, { action: "resume", id: alarm.id });
labSql(
  "UPDATE issue_member_reminder SET scheduled_at=now()-interval '1 second' WHERE id=:'id'",
  { id: alarm.id },
);
await waitResult(
  () => api(a, follow),
  (f) => f.reminders[0].status === "delivered",
);
assert.equal(
  (await api(a, "/inbox")).filter((n) => n.details?.reminder_id === alarm.id)
    .length,
  1,
);
await api(a, follow, { action: "delete", id: alarm.id });
const posted = await api(a, "/issues/" + t1.id + "/comments", {
  content: "第一版",
});
await api(
  b,
  "/comments/" + posted.id,
  { content: "无权修改" },
  { method: "PUT", denied: [403, 404] },
);
await api(
  a,
  "/comments/" + posted.id,
  { content: "修订后的评论" },
  { method: "PUT" },
);
const reply = await api(b, "/issues/" + t1.id + "/comments", {
  content: "收到",
  parent_id: posted.id,
});
await api(b, "/comments/" + posted.id + "/reactions", { emoji: "👍" });
assert.ok(reply.id);
console.log(
  "PASS 关联链接校验及移除、私有定时提醒暂停恢复和真实站内送达、跨身份评论权限",
);
await api(a, "/comments/" + posted.id + "/keep-replies", undefined, {
  method: "DELETE",
});
assert.equal(
  (await api(b, "/issues/" + t1.id + "/comments")).some(
    (m) => m.id === reply.id && m.content === "收到",
  ),
  true,
);
console.log("PASS 删除父评论保留其他成员的回复");

const currentGroup = await api(a, rooms + "/" + group.id);
const revised = {
  title: currentGroup.title,
  members: [b.user.id],
  revision: currentGroup.revision,
  project_id: "",
};
await api(b, rooms + "/" + group.id, revised, {
  method: "PUT",
  denied: [404, 403],
});
const removalAck = await api(a, rooms + "/" + group.id, revised, { method: "PUT" });
assert.deepEqual(removalAck,{id:group.id,revision:currentGroup.revision+1,title:currentGroup.title,project_id:null});
await api(a, rooms + "/" + group.id, revised, { method: "PUT", denied: [409] });
await api(c, rooms + "/" + group.id, undefined, { denied: [404] });
assert.ok(
  !(await api(c, rooms + "?q=" + encodeURIComponent(stamp))).some(
    (r) => r.id === group.id,
  ),
);
await api(c,"/workbench/room-files/"+groupFile,undefined,{denied:[404]});
assert.ok(!(await api(c,"/workbench/files")).some(f=>f.id===groupFile));
console.log("PASS 群成员移除立即撤销历史与搜索权限，过期编辑拒绝");

const seeded = (path, body, options) =>
  call(a, "/api" + path, body, { ws: sample.ws, ...options });
const release = (await seeded("/projects")).projects.find(
  (p) => p.title === "新版发布准备",
);
const blueprint = "/projects/" + release.id + "/blueprint";
const initial = (await seeded(blueprint + "/draft", {})).draft;
const beforeCount = (await seeded("/issues")).total;
const planPath = "/projects/" + release.id + "/planning-requests";
const opts = {
  purpose: "blueprint",
  agent_id: "work",
  scope: "add",
  expected_revision: initial.revision,
  request_id: randomUUID(),
  instructions: "补充回归证据",
  materials: "验收清单",
};
const input = await seeded(planPath, { ...opts, preview: true });
const planned = await seeded(planPath, {
  ...opts,
  input_hash: input.input_hash,
});
const completed = await waitResult(
  async () =>
    (await seeded(planPath)).requests.find((r) => r.id === planned.id),
  (r) => r?.status === "succeeded" || r?.status === "failed",
);
assert.equal(completed.status, "succeeded", completed.error);
const changes = completed.result.changes.map((c) => c.id);
const adopt = {
  request_id: planned.id,
  selected: changes,
  expected_revision: initial.revision,
};
await seeded(blueprint + "/draft/apply-suggestion", {
  ...adopt,
  preview: true,
});
await seeded(blueprint + "/draft/apply-suggestion", adopt);
assert.equal((await seeded("/issues")).total, beforeCount);
const modified = (await seeded(blueprint + "/draft", {})).draft;
assert.ok(modified.graph.nodes.length > initial.graph.nodes.length);
await seeded(blueprint + "/publish", {
  request_id: randomUUID(),
  expected_revision: modified.revision,
  base_version: modified.base_version,
});
assert.equal((await seeded("/issues")).total, beforeCount + 2);
const twins = (await seeded("/workbench/files")).filter(
  (f) => f.filename === "弱网上传验收清单.md",
);
assert.deepEqual(twins.map((f) => f.kind).sort(), ["issue", "room"]);
for (const f of twins) {
  const data = await seeded(
    f.kind === "room"
      ? "/workbench/room-files/" + f.id
      : "/attachments/" + f.id + "/download",
  );
  assert.match(data, /同一请求标识重试/);
}
const seedFile=twins.find(f=>f.kind==="issue");
assert.equal(seedFile.downloadable,true);
assert.ok(seedFile.message_id);
const fileComment=await seeded("/issues/"+seedFile.source_id+"/comments",{content:"历史附件",suppress_run:true});
const metadataId=labSql(`INSERT INTO attachment(workspace_id,issue_id,comment_id,uploader_type,uploader_id,filename,url,content_type,size_bytes)
  VALUES(:'workspace',:'issue',:'comment','member',:'user','历史目录.csv','','text/csv',0) RETURNING id`,
  {workspace:sample.ws,issue:seedFile.source_id,comment:fileComment.id,user:a.user.id});
const metadataRow=(await seeded("/workbench/files")).find(f=>f.id===metadataId);
assert.equal(metadataRow.message_id,fileComment.id);assert.equal(metadataRow.downloadable,false);
await seeded("/attachments/"+metadataId+"/download",undefined,{denied:[404]});
await seeded("/comments/"+fileComment.id+"/keep-replies",undefined,{method:"DELETE"});
assert.ok(!(await seeded("/workbench/files")).some(f=>f.id===metadataId));
console.log("PASS 文件聚合返回来源消息、可下载零字节，旧元数据无下载，删除评论后移出聚合");
console.log(
  "PASS Mock 规划建议、预览采纳只写草案、确认发布写任务、同名文件原字节和来源",
);
const [squad] = await seeded("/squads");
const squadOpen = "/workbench/squad-room/" + squad.id;
const [squadRoom, duplicateRoom] = await Promise.all([
  seeded(squadOpen, {}),
  seeded(squadOpen, {}),
]);
assert.equal(squadRoom.id, duplicateRoom.id);
const groupRoute = rooms + "/" + squadRoom.id;
assert.equal((await seeded(groupRoute)).members.length, 3);
const squadRequest = {
  request_id: randomUUID(),
  content: "请队长检查弱网场景验收条件",
};
const squadPost = await seeded(groupRoute + "/messages", squadRequest);
assert.equal(
  (await seeded(groupRoute + "/messages", squadRequest)).id,
  squadPost.id,
);
const squadQueued = await waitResult(
  () => seeded(groupRoute),
  (r) => ["queued", "failed"].includes(r.messages[0].agent?.status),
);
assert.equal(
  squadQueued.messages[0].agent.status,
  "queued",
  JSON.stringify(squadQueued.messages[0].agent),
);
assert.equal(squadQueued.messages.length, 1);
assert.equal(squadQueued.messages[0].work, null);
assert.equal(
  labSql(
    "SELECT count(*) FROM room_agent_turn WHERE message_id=:'id' AND task_id IS NOT NULL",
    { id: squadPost.id },
  ),
  "1",
);
await call(outsider, "/api" + groupRoute, undefined, {
  ws: sample.ws,
  denied: [403, 404],
});
console.log(
  "PASS 混合小队会话复用、成员归属、预配队长真实入队、重复消息唯一执行请求",
);
const workDraft = {
  request_id: randomUUID(),
  agent_id: "work",
  prompt: "核实工单中断网重试条件",
  timezone: "Asia/Shanghai",
};
const issueCount = (await api(a, "/issues")).total;
const workDraftRequest = await api(a, "/task-drafts", workDraft);
assert.equal((await api(a, "/task-drafts", workDraft)).id, workDraftRequest.id);
await api(
  a,
  "/task-drafts",
  { ...workDraft, prompt: "不同要求" },
  { denied: [409] },
);
const readyDraft = await waitResult(
  () => api(a, "/task-drafts/" + workDraftRequest.id),
  (r) => r.status === "succeeded" || r.status === "failed",
);
assert.equal(readyDraft.status, "succeeded", JSON.stringify(readyDraft));
assert.equal(readyDraft.draft.title, workDraft.prompt);
await api(b, "/task-drafts/" + workDraftRequest.id, undefined, {
  denied: [404],
});
assert.equal((await api(a, "/issues")).total, issueCount);
const workAgent = (await api(a, "/agents")).find(
  (x) => x.system_key === "mobilework",
);
assert.ok(workAgent?.id);
await api(
  a,
  "/agents/" + workAgent.id,
  { name: "覆盖预配" },
  { method: "PUT", denied: [403] },
);
async function executeWork(title, expected) {
  const job = await api(a, "/issues", {
    title,
    description: "保留三条验收步骤",
    status: "todo",
    assignee_type: "agent",
    assignee_id: workAgent.id,
  });
  const result = await waitResult(
    async () =>
      labSql(
        "SELECT status FROM agent_task_queue WHERE issue_id=:'id' ORDER BY created_at DESC LIMIT 1",
        { id: job.id },
      ),
    (s) => s === "completed" || s === "failed",
  );
  assert.equal(result, expected);
  const comments = await api(b, "/issues/" + job.id + "/comments");
  assert.equal(
    comments.filter((c) => c.author_id === workAgent.id).length,
    expected === "completed" ? 1 : 0,
  );
  assert.equal(
    labSql(
      "SELECT count(*) FROM agent_task_queue WHERE issue_id=:'id' AND started_at IS NOT NULL AND completed_at>=started_at",
      { id: job.id },
    ),
    "1",
  );
  return job;
}
const runIssue = await executeWork("确认两次上传产生单份结果", "completed");
await executeWork("【模拟失败】缺失材料", "failed");
console.log(
  "PASS 内置 Work 草拟、确认前不建任务、私有草案，以及预配智能体真实排队和开始结束回执（模型 Mock）",
);

// Retrying the same HTTP operation, even after it finishes, returns its original queue ID.
const manualIssue=await api(a,"/issues",{title:"独立手动执行",status:"todo",assignee_type:"agent",assignee_id:workAgent.id,suppress_run:true});
const manualPath=id=>"/workbench/issues/"+id+"/followup";
const runKey={action:"run",id:randomUUID()};
const [firstRun,replayedRun]=await Promise.all([api(a,manualPath(manualIssue.id),runKey),api(a,manualPath(manualIssue.id),runKey)]);
assert.equal(firstRun.status,"queued",JSON.stringify(firstRun));
assert.deepEqual(replayedRun,firstRun);
await waitResult(()=>labSql("SELECT status FROM agent_task_queue WHERE id=:'id'",{id:firstRun.task_id}),s=>s==="completed");
assert.deepEqual(await api(a,manualPath(manualIssue.id),runKey),firstRun);
assert.equal(labSql("SELECT count(*) FROM agent_task_queue WHERE issue_id=:'id'",{id:manualIssue.id}),"1");
await api(a,manualPath(runIssue.id),runKey,{denied:[409]});
await api(outsider,manualPath(manualIssue.id),runKey,{ws:sample.ws,denied:[403,404]});
await api(a,manualPath(manualIssue.id),runKey,{ws:sample.ws,denied:[403,404]});
const retryKey={action:"run",id:randomUUID(),source_task_id:firstRun.task_id};
const retryReceipt=await api(a,manualPath(manualIssue.id),retryKey);
assert.equal(retryReceipt.status,"queued");
assert.notEqual(retryReceipt.task_id,firstRun.task_id);
assert.deepEqual(await api(a,manualPath(manualIssue.id),retryKey),retryReceipt);
await api(a,manualPath(runIssue.id),{...retryKey,id:randomUUID()},{denied:[404]});
const humanIssue=await api(a,"/issues",{title:"人工执行拒绝",assignee_type:"member",assignee_id:a.user.id,suppress_run:true});
const invalidRun={action:"run",id:randomUUID()};
const failureReceipt=await api(a,manualPath(humanIssue.id),invalidRun);
assert.equal(failureReceipt.status,"failed");
assert.equal(failureReceipt.task_id,undefined);
assert.deepEqual(await api(a,manualPath(humanIssue.id),invalidRun),failureReceipt);
const failedHistory = (await api(a,manualPath(humanIssue.id))).requests;
assert.equal(failedHistory.length,1);
assert.equal(failedHistory[0].id,invalidRun.id);
assert.equal(failedHistory[0].reason,failureReceipt.reason);
assert.ok(Date.parse(failedHistory[0].created_at));
assert.equal((await api(b,manualPath(humanIssue.id))).requests.length,0);
const queuedHistory = (await api(a,manualPath(manualIssue.id))).requests;
assert.equal(queuedHistory.find(r=>r.id===firstRun.id).task_id,firstRun.task_id);
console.log("PASS 执行请求按本人和任务回读，重放后仅存同一失败回执，成功回执关联原队列 ID");
await waitResult(()=>labSql("SELECT status FROM agent_task_queue WHERE id=:'id'",{id:retryReceipt.task_id}),s=>s==="completed");
const ordinary={content:"[Work](mention://agent/"+workAgent.id+") 核对原文",request_id:randomUUID(),suppress_run:true};
const written=await api(a,"/issues/"+manualIssue.id+"/comments",ordinary);
assert.ok(written.id);
const changed=await api(a,"/comments/"+written.id,{content:ordinary.content+"（已校对）",content_base:ordinary.content,expected_revision:written.revision,suppress_run:true},{method:"PUT"});
assert.equal(changed.id,written.id);
assert.equal(labSql("SELECT count(*) FROM agent_task_queue WHERE issue_id=:'id'",{id:manualIssue.id}),"2");
console.log("PASS 评论与编辑保留智能体提及和原文，不产生新的执行请求");
console.log("PASS 手动执行的并发请求、结束后重放、历史重试、跨任务冲突、无权访问与无执行端回执");

const roomBefore = await api(a, rooms + "/" + room.id);
const projectAck = await api(
  a,
  rooms + "/" + room.id,
  {
    revision: roomBefore.revision,
    title: "灰度验收",
    new_project: "群聊项目 " + stamp,
  },
  { method: "PUT" },
);
const roomAfter = await api(a, rooms + "/" + room.id);
assert.deepEqual(projectAck,{id:room.id,title:roomAfter.title,revision:roomBefore.revision+1,project_id:roomAfter.project_id});
assert.equal(
  (await api(a, "/projects/" + roomAfter.project_id)).title,
  "群聊项目 " + stamp,
);
const instruction =
  "@Work 请分析当前会话记录，提炼可执行事项，创建任务并关联到本会话。\n\n核对私聊验收安排";
const results = await Promise.all(
  [a, b].map((actor) =>
    api(actor, rooms + "/" + room.id + "/messages", {
      request_id: randomUUID(),
      content: instruction,
    }),
  ),
);
const after = await api(a, rooms + "/" + room.id);
const cards = after.messages.filter((m) => results.some((r) => r.id === m.id));
assert.equal(cards.length, 2);
assert.equal(cards[0].tasks[0], cards[1].tasks[0]);
assert.ok(cards[0].tasks[0]);
assert.equal(
  (await api(c, "/issues/" + cards[0].tasks[0])).project_id,
  roomAfter.project_id,
);
assert.deepEqual(await api(c, "/workbench/issue-source/" + cards[0].tasks[0]), {
  source: null,
});
assert.ok(cards.every((c) => c.work.status === "completed"));
console.log(
  "PASS 会话创建并关联项目、双身份同时发送同题转任务、双向来源及私聊不可见",
);
const labRuntime = labSql(
  `INSERT INTO agent_runtime(workspace_id,name,runtime_mode,provider,status,visibility,owner_id)
 VALUES(:'ws','队长验收执行端','local','codex','offline','private',:'owner') RETURNING id`,
  { ws, owner: a.user.id },
);
const runtimeOutsider=await call(null,"/auth/password/register",{username:"mwrt"+stamp,password});
const readinessPath="/workbench/model-readiness";
assert.deepEqual(await api(a,readinessPath),{runtimeStatus:"ready",modelReady:true});
assert.deepEqual(await api(b,readinessPath),{runtimeStatus:"ready",modelReady:true});
await api(runtimeOutsider,readinessPath,undefined,{denied:[403,404]});
console.log("PASS 内置 Work 就绪状态按工作区鉴权，两名成员读回显式配置的适配器状态");
const loadPath="/workbench/runtime-load";
assert.deepEqual((await api(a,loadPath))[labRuntime],{running:0,assigned:0});
assert.equal((await api(b,loadPath))[labRuntime],undefined);
await api(b,"/runtimes/"+labRuntime+"/usage",undefined,{denied:[403,404]});
await api(b,"/runtimes/"+labRuntime,{max_concurrent_tasks:2},{method:"PATCH",denied:[403,404]});
await api(runtimeOutsider,loadPath,undefined,{denied:[403,404]});
const profilePath="/workspaces/"+ws+"/runtime-profiles";
const profileBody={display_name:"协议回放"+stamp,runtime_type:"codex",command_name:"mw-replay-cli",enabled:false};
await api(b,profilePath,profileBody,{denied:[403,404]});
await api(a,profilePath,{...profileBody,command_name:"one two"},{denied:[400]});
const profile=await api(a,profilePath,profileBody);
assert.equal(profile.enabled,false);
assert.equal((await api(b,profilePath+"/"+profile.id)).id,profile.id);
await api(a,profilePath,profileBody,{denied:[409]});
await api(runtimeOutsider,profilePath+"/"+profile.id,undefined,{denied:[403,404]});
await api(a,profilePath+"/"+profile.id,{description:"修改后的描述"},{method:"PATCH"});
assert.equal((await api(b,profilePath+"/"+profile.id)).description,"修改后的描述");
await api(a,profilePath+"/"+profile.id,undefined,{method:"DELETE"});
await api(a,profilePath+"/"+profile.id,undefined,{denied:[404]});
console.log("PASS 运行时负载与用量按身份隔离，普通成员禁止编辑设备、管理配置，配置创建编辑删除及跨团队隔离");
const ownAgent = await api(a, "/agents", {
  name: "弱网验收助手",
  instructions: "核对条件",
  description: "交付清单",
  runtime_id: labRuntime,
  permission_mode: "public_to",
  invocation_targets: [{ target_type: "member", target_id: b.user.id }],
});
// Controlled in-flight rows exercise the load calculation without starting an external executor.
const probeArgs={agent:ownAgent.id,runtime:labRuntime,run:randomUUID(),sent:randomUUID(),done:randomUUID()};
labSql(`INSERT INTO agent_task_queue(id,agent_id,runtime_id,status,dispatched_at,started_at)
  VALUES(:'run',:'agent',:'runtime','running',now(),now()),(:'sent',:'agent',:'runtime','dispatched',now(),NULL),
        (:'done',:'agent',:'runtime','completed',now(),now())`,probeArgs);
try {
  assert.deepEqual((await api(a,loadPath))[labRuntime],{running:1,assigned:1});
  assert.equal((await api(b,loadPath))[labRuntime],undefined);
  await api(a,"/runtimes/"+labRuntime,{visibility:"public"},{method:"PATCH"});
  assert.deepEqual((await api(b,loadPath))[labRuntime],{running:1,assigned:1});
  labSql("UPDATE agent_task_queue SET status='completed', completed_at=now() WHERE id IN (:'run',:'sent')",probeArgs);
  assert.deepEqual((await api(b,loadPath))[labRuntime],{running:0,assigned:0});
} finally {
  labSql("DELETE FROM agent_task_queue WHERE id IN (:'run',:'sent',:'done')",probeArgs);
  await api(a,"/runtimes/"+labRuntime,{visibility:"private"},{method:"PATCH"});
}
console.log("PASS 受控队列中已分配和实际运行分别计数，终态退出计数，共享前后权限随设备变化");
const mentionRoom=await api(a,rooms,{title:"提及权限 "+stamp,kind:"group",members:[b.user.id,c.user.id]});
const mentionsURL=rooms+"/"+mentionRoom.id+"/mentions", turnsURL=rooms+"/"+mentionRoom.id+"/messages";
assert.ok((await api(b,mentionsURL)).some(agent=>agent.id===ownAgent.id));
assert.ok(!(await api(c,mentionsURL)).some(agent=>agent.id===ownAgent.id));
const membershipPath=rooms+"/"+mentionRoom.id;
const originalRoom=await api(a,membershipPath);
const preset=(await api(a,mentionsURL)).find(agent=>agent.builtin);
assert.ok(preset);
const memberChange=(user,revision,add_agents,remove_agents,denied)=>
  api(user,membershipPath,{revision,title:originalRoom.title,add_agents,remove_agents},{method:"PUT",...(denied?{denied}:{})});
await memberChange(b,originalRoom.revision,[preset.id],[],[404]);
await memberChange(a,originalRoom.revision,[preset.id,randomUUID()],[],[404]);
assert.equal((await api(a,mentionsURL)).find(agent=>agent.id===preset.id).joined,false);
await memberChange(a,originalRoom.revision,[preset.id,preset.id],[]);
await memberChange(a,originalRoom.revision,[],[preset.id],[409]);
assert.equal((await api(b,mentionsURL)).find(agent=>agent.id===preset.id).joined,true);
assert.equal((await api(b,membershipPath)).messages.length,originalRoom.messages.length);
const enrolled=await api(a,membershipPath);
await memberChange(a,enrolled.revision,[],[preset.id]);
assert.equal((await api(a,mentionsURL)).find(agent=>agent.id===preset.id).joined,false);
const privateAgent=await api(a,"/agents",{name:"群中私有智能体"+stamp,runtime_id:labRuntime,instructions:"核对材料",description:"仅创建人使用",permission_mode:"private"});
const currentMembership=await api(a,membershipPath);
await memberChange(a,currentMembership.revision,[privateAgent.id],[]);
assert.ok((await api(a,mentionsURL)).some(agent=>agent.id===privateAgent.id&&agent.joined));
assert.ok(!(await api(b,mentionsURL)).some(agent=>agent.id===privateAgent.id));
await api(b,turnsURL,{content:"@"+privateAgent.name+" 查看",agent_id:privateAgent.id,request_id:randomUUID()},{denied:[404]});
console.log("PASS 群聊真人与智能体独立成员、内置 Work 加入和移除、重复与过期版本、无效对象整笔回滚，私有智能体入群不扩大调用权");
const pickedAgent={agent_id:ownAgent.id,content:"@"+ownAgent.name+" 核对",request_id:randomUUID()};
await api(c,turnsURL,pickedAgent,{denied:[404]});
await api(b,turnsURL,{...pickedAgent,content:"@"+ownAgent.name+"延伸"},{denied:[409]});
const similar=await api(b,turnsURL,{request_id:randomUUID(),content:"前缀@"+ownAgent.name+" 与 @"+ownAgent.name+"延伸"});
const chosen=await api(b,turnsURL,pickedAgent);
const received=(await api(b,rooms+"/"+mentionRoom.id)).messages;
assert.equal(received.find(m=>m.id===similar.id).agent,null);
assert.equal(received.find(m=>m.id===chosen.id).agent.name,ownAgent.name);
assert.equal(received.length,2);
await api(
  c,
  "/chat/sessions",
  { agent_id: ownAgent.id, title: "越权不可用" },
  { denied: [403, 404] },
);
const chat = await api(b, "/chat/sessions", {
  agent_id: ownAgent.id,
  title: "弱网验收私聊",
});
await api(c, "/chat/sessions/" + chat.id, undefined, { denied: [403, 404] });
const chatUpload=new FormData();
chatUpload.append("chat_session_id",chat.id);
chatUpload.append("file",new Blob(["智能体私聊附件"]), "成员专用.txt");
const chatUploadReply=await fetch(base+"/api/upload-file",{method:"POST",headers:{authorization:"Bearer "+b.token,"X-Workspace-ID":ws},body:chatUpload});
assert.ok(chatUploadReply.ok,"智能体会话上传返回 "+chatUploadReply.status);
const chatFile=await chatUploadReply.json();
const agentMsg = { request_id: randomUUID(), content: "核对三项标准",attachment_ids:[chatFile.id] };
const messagesRoute = "/chat/sessions/" + chat.id + "/messages";
const chatAnswer = await api(b, messagesRoute, agentMsg);
await api(b, messagesRoute, agentMsg);
assert.equal(
  (await api(b, messagesRoute)).filter((m) => m.role === "user").length,
  1,
);
assert.deepEqual(chatAnswer.attachment_ids,[chatFile.id]);
assert.ok((await files(b)).some(f=>f.id===chatFile.id && f.source_id===chat.id && f.kind==="agent-chat"));
assert.ok(!(await files(a)).some(f=>f.id===chatFile.id));
assert.ok((await navigation(b)).some(i=>i.kind==="agent" && i.id===chat.id));
assert.ok(!(await navigation(a)).some(i=>i.id===chat.id));
await api(a,"/attachments/"+chatFile.id+"/download",undefined,{denied:[403,404]});
assert.equal(await api(b,"/attachments/"+chatFile.id+"/download"),"智能体私聊附件");
await api(a,"/agents/"+ownAgent.id,{permission_mode:"private"},{method:"PUT"});
assert.ok(!(await api(b,mentionsURL)).some(agent=>agent.id===ownAgent.id));
assert.equal((await api(b,turnsURL,pickedAgent)).id,chosen.id);
await api(b,turnsURL,{...pickedAgent,request_id:randomUUID()},{denied:[404]});
assert.equal((await api(b,rooms+"/"+mentionRoom.id)).messages.length,2);
console.log("PASS 会话智能体候选按调用权过滤、按 ID 提及、名称边界、收回权限及重放不额外派发");

assert.ok(!(await files(b)).some(f=>f.id===chatFile.id));
assert.ok(!(await navigation(b)).some(i=>i.id===chat.id));
await api(b,"/attachments/"+chatFile.id+"/download",undefined,{denied:[403,404]});
console.log("PASS 智能体会话附件绑定和下载、同团队其他成员隔离、收回调用权后列表和下载同时失效");
await api(
  a,
  "/agents/" + ownAgent.id,
  {
    description: "编辑后的说明",
    permission_mode: "public_to",
    invocation_targets: [{ target_type: "workspace" }],
  },
  { method: "PUT" },
);
const teamSquad = await api(a, "/squads", {
  name: "验收小队",
  instructions:"先核对来源",
  leader_id: ownAgent.id,
  description: "协作验收",
});
const sq = "/squads/" + teamSquad.id;
assert.equal((await api(a,sq)).instructions,"先核对来源");
await api(a, sq + "/members", {
  member_type: "member",
  member_id: b.user.id,
  role: "测试",
});
await api(
  a,
  sq + "/members/role",
  { member_type: "member", member_id: b.user.id, role: "验收负责人" },
  { method: "PATCH" },
);
assert.ok(
  (await api(b, sq + "/members")).some(
    (m) => m.member_id === b.user.id && m.role === "验收负责人",
  ),
);
await api(c, sq, { description: "拒绝修改" }, { method: "PUT", denied: [403] });
await api(a, sq, { description: "包含私聊与多角色操作" }, { method: "PUT" });
const mixed = await api(a, "/workbench/squad-room/" + teamSquad.id, {});
await api(b, rooms + "/" + mixed.id);
await api(c, rooms + "/" + mixed.id, undefined, { denied: [404] });
const rotate = leader => api(a,sq,{leader_id:leader},{method:"PUT"});
await rotate(workAgent.id);
assert.equal((await api(a,sq)).leader_id,workAgent.id);
const rotationMessage={content:"请按当前队长预配核对这次交付",request_id:randomUUID()};
const rotationRoom=rooms+"/"+mixed.id;
const rotationReceipt=await api(b,rotationRoom+"/messages",rotationMessage);
await waitResult(()=>api(b,rotationRoom),r=>r.messages.find(m=>m.id===rotationReceipt.id)?.work?.status==="completed");
await rotate(ownAgent.id);
assert.equal((await api(b,rotationRoom+"/messages",rotationMessage)).id,rotationReceipt.id);
assert.equal(labSql("SELECT count(*) FROM room_agent_turn WHERE message_id=:'msg'",{msg:rotationReceipt.id}),"0");
await api(a,sq+"/members",{member_type:"member",member_id:b.user.id},{method:"DELETE"});
assert.ok(!(await api(a,sq+"/members")).some(m=>m.member_id===b.user.id));
assert.ok((await api(b,rotationRoom)).messages.some(m=>m.id===rotationReceipt.id));
console.log("PASS 更换小队队长、内置 Work 应答、换回后重发保持原派发、移除小队成员保留独立会话关系（模型 Mock）");
// Preserve a separate real issue for each combination of lifecycle and assignee.
const allStates = ["backlog", "todo", "in_progress", "in_review", "blocked", "done", "cancelled"];
const finishedState = value => value === "done" || value === "cancelled";
const workFor = async (type, id) => {
  const result = [];
  for (const status of allStates) {
    const issue = await api(a,"/issues",{
      title:"归档复验 " + type + " " + status, status,
      assignee_type:type, assignee_id:id, suppress_run:true,
    });
    assert.equal(issue.status,status);
    result.push(issue);
  }
  return result;
};
const agentWork = await workFor("agent", ownAgent.id);
const squadWork = await workFor("squad", teamSquad.id);
const alreadyWorking = agentWork.find(i => i.status === "todo");
const requestedRun = await api(a,manualPath(alreadyWorking.id),{action:"run",id:randomUUID()});
assert.equal(requestedRun.status, "queued");
const auditCount = (issue,source) => Number(labSql(
  "SELECT count(*) FROM activity_log WHERE workspace_id=:'ws' AND issue_id=:'id' AND details->>'source'=:'source'",
  {ws,id:issue.id,source}));
const formerLeader = await api(a, "/agents", {
  name:"临时交接队长 " + stamp, instructions:"核对清单", runtime_id:labRuntime,
});
await rotate(formerLeader.id);
await api(a,"/agents/"+formerLeader.id+"/archive",{},{denied:[409]});
assert.ok(!(await api(a,"/agents/"+formerLeader.id)).archived_at);
// Reproduce a pre-upgrade squad whose leader was already archived.
labSql("UPDATE agent SET archived_at=now(),archived_by=:'actor' WHERE id=:'id' AND workspace_id=:'ws'",{
  actor:a.user.id,id:formerLeader.id,ws});
await api(a,sq,undefined,{method:"DELETE",denied:[409]});
assert.ok(!(await api(a,sq)).archived_at);
for (const issue of squadWork) {
  assert.equal((await api(a,"/issues/"+issue.id)).assignee_id,teamSquad.id);
  assert.equal(auditCount(issue,"squad_archived"),0);
}
await rotate(ownAgent.id);
await api(a,sq,{leader_id:formerLeader.id},{method:"PUT",denied:[400,409]});
await api(a,"/squads",{name:"已归档队长校验 " + stamp,leader_id:formerLeader.id},{denied:[400,409]});
await api(a, sq, undefined, { method: "DELETE" });
assert.ok(
  !(await api(a, "/squads")).some(
    (s) => s.id === teamSquad.id && !s.archived_at,
  ),
);
for (const initial of squadWork) {
  const stored = await api(b,"/issues/"+initial.id);
  assert.equal(stored.status,initial.status);
  assert.equal(stored.assignee_type,finishedState(initial.status) ? "squad" : "agent");
  assert.equal(stored.assignee_id,finishedState(initial.status) ? teamSquad.id : ownAgent.id);
  assert.equal(auditCount(initial,"squad_archived"),finishedState(initial.status) ? 0 : 1);
}
console.log("PASS 小队归档以当前队长交接五类未完成业务任务，两类终态保留小队和历史，在任队长不能归档，旧版无可用队长时整笔回滚");
await api(a, "/agents/" + ownAgent.id + "/archive", {});
assert.ok(!(await api(a, "/agents")).some((x) => x.id === ownAgent.id));
const archivedQueue = () => labSql("SELECT status FROM agent_task_queue WHERE id=:'id'",{id:requestedRun.task_id});
assert.equal(archivedQueue(),"cancelled");
for (const initial of [...agentWork,...squadWork]) {
  const stored = await api(b,"/issues/"+initial.id);
  assert.equal(stored.status,finishedState(initial.status) ? initial.status : "cancelled");
  assert.equal(auditCount(initial,"agent_archived"),finishedState(initial.status) ? 0 : 1);
}
await api(a,"/issues",{title:"归档以后不能新指派",assignee_type:"agent",assignee_id:ownAgent.id,suppress_run:true},{denied:[400,409,422]});
await api(a,"/issues/"+alreadyWorking.id,{status:"todo",suppress_run:true},{method:"PUT",denied:[409]});
assert.equal((await api(a,"/issues/"+alreadyWorking.id)).status,"cancelled");
await api(a, "/agents/" + ownAgent.id + "/restore", {});
assert.equal(
  (await api(a, "/agents/" + ownAgent.id)).description,
  "编辑后的说明",
);
for (const initial of agentWork) {
  assert.equal((await api(b,"/issues/"+initial.id)).status,finishedState(initial.status) ? initial.status : "cancelled");
}
assert.equal(archivedQueue(),"cancelled");
console.log("PASS 智能体归档同时取消五类未完成业务任务和真实执行队列，保留两类终态、逐任务活动；恢复后不重开旧任务");
console.log(
  "PASS 新建智能体、指定成员调用、私聊重复发送、访问范围修改、归档恢复及混合小队角色、会话和归档",
);

const mineInbox = await api(b, "/inbox");
const notice = mineInbox.find((n) => n.issue_id === up.issue_id);
await api(b, "/inbox/" + notice.id + "/read", {});
assert.equal(
  (await api(b, "/inbox")).find((n) => n.id === notice.id).read,
  true,
);
await api(b, "/inbox/mark-all-read", {});
assert.ok((await api(b, "/inbox")).every((n) => n.read));
console.log("PASS 通知个人单读与全部已读刷新，保留历史");
// A concurrently edited issue must abort the entire version (including new nodes).
const conflictProject = await api(a, "/projects", {
  title: "独立并发冲突 " + stamp,
});
const cp = "/projects/" + conflictProject.id + "/blueprint";
const init = (await api(a, cp + "/draft", {})).draft;
const contract = node("检查发布冲突", 80);
const rawDraft = (
  await api(
    a,
    cp + "/draft",
    {
      expected_revision: init.revision,
      graph: { schema_version: 1, nodes: [contract], edges: [] },
    },
    { method: "PUT" },
  )
).draft;
const vbody = {
  base_version: rawDraft.base_version,
  expected_revision: rawDraft.revision,
};
const both = await Promise.allSettled(
  [1, 2].map(() =>
    api(a, cp + "/publish", { ...vbody, request_id: randomUUID() }),
  ),
);
assert.equal(both.filter((r) => r.status === "fulfilled").length, 1);
assert.match(both.find((r) => r.status === "rejected").reason.message, /409/);
const drift = (await api(a, cp + "/draft", {})).draft;
const affected = drift.graph.nodes[0];
const nextGraph = {
  ...drift.graph,
  nodes: [{ ...affected, title: "草案中的调整" }, node("禁止部分写入", 410)],
};
const pending = (
  await api(
    a,
    cp + "/draft",
    { expected_revision: drift.revision, graph: nextGraph },
    { method: "PUT" },
  )
).draft;
await api(
  b,
  "/issues/" + affected.issue_id,
  { title: "负责人已经修订" },
  { method: "PUT" },
);
await api(
  a,
  cp + "/publish",
  {
    base_version: pending.base_version,
    expected_revision: pending.revision,
    request_id: randomUUID(),
  },
  { denied: [409] },
);
assert.equal(
  (await api(a, "/issues?project_id=" + conflictProject.id)).total,
  1,
);
assert.equal(
  (await api(a, "/issues/" + affected.issue_id)).title,
  "负责人已经修订",
);
await api(
  a,
  "/projects/" + conflictProject.id,
  {
    lead_type: "member",
    lead_id: (await seeded("/workspaces/" + sample.ws + "/members")).find(
      (m) => m.user_id !== a.user.id,
    ).user_id,
  },
  { method: "PUT", denied: [400, 403, 422] },
);
console.log(
  "PASS 不同幂等键并发发布仅一次成功，外部修改合同字段触发事务回滚，跨空间负责人拒绝",
);

const wRoute = "/issues/" + runIssue.id + "/wakeups";
const wakeBody = {
  agent_id: workAgent.id,
  kind: "at",
  at: new Date(Date.now() + 3600000).toISOString(),
  instruction: "核对定时运行交付",
  timezone: "Asia/Shanghai",
};
const wake = await api(a, wRoute, wakeBody);
assert.ok(wake.id);
const pausedWake = await api(a, wRoute + "/" + wake.id + "/disable", {});
await api(a, wRoute + "/" + wake.id + "/enable", {
  revision: pausedWake.revision,
});
await api(a, wRoute + "/" + wake.id + "/trigger", {});
await waitResult(
  () => api(a, wRoute + "/" + wake.id + "/runs"),
  (rows) => rows.length > 0,
);

await api(a, wRoute + "/" + wake.id, undefined, { method: "DELETE" });
console.log(
  "PASS 绑定智能体的真实唤醒规则、暂停、恢复、手动触发、运行轨迹和删除",
);
const unreadRoom = await api(a, rooms, {
  kind: "group",
  title: "未读隔离",
  members: [b.user.id, c.user.id],
});
const unreadPath = rooms + "/" + unreadRoom.id;
const unique = {
  content: "只有参与者可见的收件箱事件",
  request_id: randomUUID(),
};
const n = await api(a, unreadPath + "/messages", unique);
await api(a, unreadPath + "/messages", unique);
assert.equal(
  (await api(b, rooms)).find((r) => r.id === unreadRoom.id).unread,
  1,
);
assert.equal(
  (await api(b, "/inbox")).filter((i) => i.details?.message_id === n.id).length,
  1,
);
const navUnread=(await navigation(b)).filter(i=>i.kind!=="issue");
assert.equal(navUnread[0].id,unreadRoom.id);
assert.equal(navUnread[0].unread,1);
await api(b, unreadPath + "/read", { last: n.id });
assert.equal(
  (await api(b, rooms)).find((r) => r.id === unreadRoom.id).unread,
  0,
);
assert.equal((await navigation(b)).find(i=>i.id===unreadRoom.id).unread,0);
const existingRoom = await api(a, unreadPath);
await api(
  a,
  unreadPath,
  {
    revision: existingRoom.revision,
    title: existingRoom.title,
    members: [b.user.id],
  },
  { method: "PUT" },
);
assert.ok(
  !(await api(c, "/inbox")).some((i) => i.details?.room_id === unreadRoom.id),
);
await api(c, unreadPath, undefined, { denied: [404] });
assert.ok(!(await navigation(c)).some(i=>i.id===unreadRoom.id));
console.log("PASS 侧栏聚合按身份授权、跨类型活动排序、关联任务、未读同步与移除会话成员");
await api(
  a,
  prefs,
  { ...(await api(a, prefs)), instructions: "长".repeat(151) },
  { method: "PUT", denied: [422] },
);
const envPath = "/agents/" + ownAgent.id + "/env";
await api(
  a,
  envPath,
  { custom_env: { MW_ACCEPTANCE: "fixture-only" } },
  { method: "PUT" },
);
await api(c, envPath, undefined, { denied: [403, 404] });
for (const name of ["1BAD","HAS SPACE","HAS-DASH","EMPTY=VALUE",""]) {
  await api(a,envPath,{custom_env:{[name]:"test-only"}},{method:"PUT",denied:[422]});
}
await api(c,envPath,{custom_env:{NEW_NAME:"test-only"}},{method:"PUT",denied:[403,404]});
assert.equal((await api(a, envPath)).custom_env.MW_ACCEPTANCE, "fixture-only");
await api(a, envPath, { custom_env: {} }, { method: "PUT" });
console.log(
  "PASS 消息通知去重、可见会话已读、移除参与者清理通知和回链；指令边界与智能体环境权限",
);

const newTask = {
  title: "表单验收 " + stamp,
  status: "todo",
  priority: "urgent",
  start_date: "2026-12-02",
  due_date: "2026-12-03",
  label_names: ["联调", "V3", "联调"],
  suppress_run: true,
};
await api(
  a,
  "/issues",
  { ...newTask, due_date: "2026-12-01" },
  { denied: [400] },
);
const labeled = await api(a, "/issues", newTask);
assert.equal(labeled.priority, "urgent");
assert.deepEqual(
  (await api(b, "/issues/" + labeled.id + "/labels")).labels
    .map((l) => l.name)
    .sort(),
  ["V3", "联调"],
);
await api(
  b,
  "/issues/" + labeled.id,
  { start_date: "2026-12-04" },
  { method: "PUT", denied: [400] },
);
assert.equal((await api(a, "/issues/" + labeled.id)).start_date, "2026-12-02");
const pinTitle="分页置顶"+stamp;
const pinTasks=[];
for (const suffix of ["A","B","C","D"]) pinTasks.push(await api(a,"/issues",{title:pinTitle+suffix,suppress_run:true}));
const pinPage=(actor,cursor)=>api(actor,"/issues/table/rows",{
  prioritize_pins:true,query:{scope:{kind:"workspace"},search:pinTitle,sort:{field:"title",direction:"asc"}},
  group:{kind:"none"},group_key:null,parent_id:null,hierarchy:{enabled:false},page:{limit:1,cursor},
});
for(const task of pinTasks.slice(2)) await api(b,"/pins",{item_type:"issue",item_id:task.id});
let pageToken=null;
const actual=[];
do {
  const result=await pinPage(b,pageToken);
  actual.push(...result.rows.map(row=>row.issue.id));
  pageToken=result.next_cursor;
} while(pageToken && actual.length<6);
assert.deepEqual(actual,[2,3,0,1].map(i=>pinTasks[i].id));
assert.equal((await pinPage(a,null)).rows[0].issue.id,pinTasks[0].id);
console.log("PASS 个人置顶跨页排序、两个置顶项之间的游标、回到普通任务及另一账号顺序隔离");
const tagPath = "/workbench/issues/" + labeled.id + "/labels";
const replaceTags = (actor,names,revision,options={}) => api(actor,tagPath,{names,expected_revision:revision},{method:"PUT",...options});
const beforeLabels=await api(a,"/issues/"+labeled.id);
await replaceTags(b,["联调","验收","验收"],beforeLabels.revision);
await replaceTags(a,["过期写入"],beforeLabels.revision,{denied:[409]});
const afterLabels=await api(a,"/issues/"+labeled.id);
assert.equal(afterLabels.revision,beforeLabels.revision+1);
assert.deepEqual((await api(a,"/issues/"+labeled.id+"/labels")).labels.map(l=>l.name).sort(),["联调","验收"]);
await replaceTags(a,[" "],afterLabels.revision,{denied:[400]});
await replaceTags(a,[],afterLabels.revision);
assert.equal((await api(b,"/issues/"+labeled.id+"/labels")).labels.length,0);
console.log("PASS 表内标签原子替换、重名去重、过期版本拒绝、非法值回滚、另一身份重读及清空");
const child = await api(a, "/issues", {
  title: "保留下属",
  parent_issue_id: labeled.id,
});
await api(a, "/issues/" + labeled.id, undefined, { method: "DELETE" });
assert.equal((await api(a, "/issues/" + child.id)).parent_issue_id, null);
const draftSquad = await api(a, "/squads", {
  name: "内置队长小队",
  leader_id: workAgent.id,
});
const squadDraft = await api(a, "/task-drafts", {
  ...workDraft,
  request_id: randomUUID(),
  agent_id: "squad:" + draftSquad.id,
});
assert.equal(
  (
    await waitResult(
      () => api(a, "/task-drafts/" + squadDraft.id),
      (r) => ["succeeded", "failed"].includes(r.status),
    )
  ).status,
  "succeeded",
);
await call(
  a,
  "/api/task-drafts",
  {
    ...workDraft,
    request_id: randomUUID(),
    agent_id: "squad:" + draftSquad.id,
  },
  { ws: sample.ws, denied: [403, 404] },
);
console.log(
  "PASS 新任务起止与优先级、标签同事务去重、删除保留下属、小队起草解析与跨团队拒绝",
);

{
  const conversation=await api(a,"/workbench/conversations",{title:"仅本人可读的输入附件"});
  const filename="验收附件.txt", content="私有输入消息的原始内容";
  const attachment={filename,bytes:Buffer.from(content).toString("base64")};
  const req={conversationId:conversation.id,requestId:randomUUID(),prompt:"核对附件",files:[attachment,{filename,bytes:""}]};
  const [first,replayed]=await Promise.all([api(a,"/workbench/messages",req),api(a,"/workbench/messages",req)]);
  assert.deepEqual(first.files,replayed.files);
  assert.equal(first.files.length,2);
  assert.deepEqual((await api(a,"/workbench/messages",req)).files,first.files);
  await api(a,"/workbench/messages",{...req,files:[attachment]},{denied:[409]});
  const path="/workbench/input-files/"+first.files[0].id;
  assert.equal(await api(a,path),content);
  await api(b,path,undefined,{denied:[404]});
  await api(outsider,path,undefined,{denied:[403,404]});
  assert.ok(!(await files(b)).some(f=>f.id===first.files[0].id));
  assert.equal((await files(a)).filter(f=>f.kind==="input"&&f.source_id===conversation.id).length,2);
  await api(a,"/workbench/messages",{...req,requestId:randomUUID(),files:[{filename:"../invalid",bytes:""}]},{denied:[422]});
  const roomRequest={kind:"direct",members:[b.user.id],title:"附件回执",content:"核对这份文件",request_id:randomUUID(),files:[attachment]};
  const room=await api(a,"/workbench/rooms",roomRequest);
  assert.equal((await api(a,"/workbench/rooms",roomRequest)).id,room.id);
  const messages=(await api(b,"/workbench/rooms/"+room.id)).messages;
  assert.equal(messages.length,2);
  const uploaded=messages.find(m=>m.filename===filename);
  assert.equal(await api(b,"/workbench/room-files/"+uploaded.id),content);
  await api(c,"/workbench/room-files/"+uploaded.id,undefined,{denied:[404]});
  console.log("PASS 首页私有 Work 附件同名、零字节、原文下载、重复请求、改内容拒绝及跨身份隔离；@成员附件与首条消息同事务提交");
}

// Due dates are civil dates. The same instant can fall on different days for two viewers.
{
  const prefix="时区回归 "+stamp+" ";
  const dates=["2026-03-07","2026-03-08","2026-03-09","2026-11-01","2026-11-02",""];
  for(const date of dates) await api(a,"/issues",{title:prefix+(date||"未排期"),status:"todo",suppress_run:true,...(date?{due_date:date}:{})});
  const rows=async(instant,zone,bucket)=>{
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(instant));
    const response=await api(a,"/issues/table/rows",{
      query:{scope:{kind:"workspace"},search:prefix.trim(),filters:{today,due_dates:[bucket]},sort:{field:"title",direction:"asc"}},
      group:{kind:"none"},page:{limit:100}
    });
    return response.rows.map(row=>row.issue.title.slice(prefix.length)).sort();
  };
  const spring="2026-03-08T05:30:00Z",fall="2026-11-01T06:30:00Z";
  assert.deepEqual(await rows(spring,"America/Los_Angeles","today"),["2026-03-07"]);
  assert.deepEqual(await rows(spring,"Asia/Shanghai","today"),["2026-03-08"]);
  assert.deepEqual(await rows(spring,"America/New_York","overdue"),["2026-03-07"]);
  assert.deepEqual(await rows(spring,"America/New_York","this_week"),["2026-03-07","2026-03-08"]);
  assert.deepEqual(await rows(spring,"America/New_York","next_7_days"),["2026-03-08","2026-03-09"]);
  assert.deepEqual(await rows(fall,"America/Los_Angeles","today"),[]);
  assert.deepEqual(await rows(fall,"America/New_York","today"),["2026-11-01"]);
  assert.deepEqual(await rows(fall,"Asia/Shanghai","none"),["未排期"]);
  console.log("PASS 日期筛选按查看者本地日期，覆盖两地跨日、美国夏令时切换、自然周、未来七天与未排期");
}


{
  const invited=await call(null,"/auth/password/register",{username:"receipt"+stamp,password});
  const personal=(await call(invited,"/api/workspaces")).find(w=>w.kind==="personal");
  assert.ok(personal);
  const personalInbox=()=>call(invited,"/api/inbox",undefined,{ws:personal.id});
  const inviteRoute="/workspaces/"+ws+"/members";
  const issueInvite=()=>api(a,inviteRoute,{email:invited.user.email,role:"member"});
  const revoked=await issueInvite();
  assert.equal((await personalInbox()).filter(n=>n.details?.invitation_id===revoked.id&&n.details.invitation_status==="pending"&&!n.read).length,1);
  await api(b,"/workspaces/"+ws+"/invitations/"+revoked.id,undefined,{method:"DELETE",denied:[403,404]});
  await api(a,"/workspaces/"+ws+"/invitations/"+revoked.id,undefined,{method:"DELETE"});
  await call(invited,"/api/invitations/"+revoked.id+"/accept",{},{denied:[404,410]});
  assert.ok((await personalInbox()).find(n=>n.details?.invitation_id===revoked.id&&n.read&&n.details.invitation_status==="revoked"));
  const invitation=await issueInvite();
  const accept=()=>call(invited,"/api/invitations/"+invitation.id+"/accept",{});
  await accept();await accept();
  for(const account of [a,invited]){
    assert.equal((await api(account,"/inbox")).filter(n=>n.type==="invitation_accepted" && n.details?.invitation_id===invitation.id).length,1);
  }
  const members=()=>api(a,inviteRoute);
  const member=(await members()).find(m=>m.user_id===invited.user.id);
  const change=(role)=>api(a,inviteRoute+"/"+member.id,{role},{method:"PATCH"});
  await change("admin");assert.equal((await members()).find(m=>m.id===member.id).role,"admin");
  await api(invited,"/workspaces/"+ws,{description:"成员提权回读"},{method:"PATCH"});
  await change("member");await api(invited,"/workspaces/"+ws,{description:"成员已降权"},{method:"PATCH",denied:[403,404]});
  await api(a,inviteRoute+"/"+member.id,undefined,{method:"DELETE"});
  await api(invited,"/workbench/navigation",undefined,{denied:[403,404]});
  assert.ok(!(await members()).some(m=>m.id===member.id));
  console.log("PASS 定向邀请个人收件箱投递、撤销使链接失效、接受双方回执去重、管理员升降权和移出后撤权");
}
{
  const username="late"+stamp;
  const invitation=await api(a,"/workspaces/"+ws+"/members",{email:username+"@demo.mobilework.invalid",role:"member"});
  const late=await call(null,"/auth/password/register",{username,password});
  const personal=(await call(late,"/api/workspaces")).find(w=>w.kind==="personal");
  for(let i=0;i<2;i++) {
    await call(late,"/api/workspaces");
    const notices=await call(late,"/api/inbox",undefined,{ws:personal.id});
    assert.equal(notices.filter(n=>n.details?.invitation_id===invitation.id&&!n.read).length,1);
  }
  await call(late,"/api/invitations/"+invitation.id+"/decline",{});
  assert.ok((await api(a,"/inbox")).some(n=>n.type==="invitation_declined" && n.details?.invitation_id===invitation.id));
  assert.ok(!(await api(a,"/workspaces/"+ws+"/members")).some(m=>m.user_id===late.user.id));
  console.log("PASS 先邀请后注册的账号在个人空间收到唯一邀请，拒绝回执可见且未加入团队");
}

// Use fresh drafts so that a rejection on one field cannot mask another.
for (const [field, draftPatch, issuePatch] of [
  ["交付要求", {requirements:"蓝图修改验收要求"}, {description:"任务负责人修改验收要求"}],
  ["截止日期", {due_date:"2027-04-02"}, {due_date:"2027-04-03"}],
  ["负责人", {assignee_type:"member",assignee_id:c.user.id}, {assignee_type:"member",assignee_id:a.user.id}],
]) {
  const p = await api(a,"/projects",{title:field+"并发核验 "+stamp});
  const plan = "/projects/"+p.id+"/blueprint";
  const saveGraph = async (draft, graph) =>
    (await api(a,plan+"/draft",{expected_revision:draft.revision,graph},{method:"PUT"})).draft;
  const body = draft => ({base_version:draft.base_version,expected_revision:draft.revision,request_id:randomUUID()});
  const original = (await api(a,plan+"/draft",{})).draft;
  const first = await saveGraph(original,{schema_version:1,nodes:[node("可编辑任务",100)],edges:[]});
  await api(a,plan+"/publish",body(first));
  const edit = (await api(a,plan+"/draft",{})).draft;
  const originalNode = edit.graph.nodes[0];
  const changed = await saveGraph(edit,{...edit.graph,nodes:[node("必须一起写入",20),{...originalNode,...draftPatch}]});
  await api(b,"/issues/"+originalNode.issue_id,issuePatch,{method:"PUT"});
  await api(a,plan+"/publish",body(changed),{denied:[409]});
  assert.equal((await api(a,plan+"/versions")).versions.length,1,field);
  assert.equal((await api(a,"/issues?project_id="+p.id)).total,1,field);
  const stored = await api(b,"/issues/"+originalNode.issue_id);
  for (const [key,value] of Object.entries(issuePatch)) {
    if(key==="due_date") assert.equal(stored[key].slice(0,10),value,field);
    else assert.equal(stored[key],value,field);
  }
}
console.log("PASS 蓝图逐字段并发冲突：交付要求、截止日期、负责人分别拒绝发布，新任务和历史版本均回滚");

{
  const project = await api(a, "/projects", {title:"同步任务最新内容 " + stamp});
  const path = "/projects/" + project.id + "/blueprint";
  const create = async () => (await api(a, path + "/draft", {})).draft;
  const update = async (draft, graph, refresh = false, options = {}) => api(a, path + "/draft", {
    expected_revision:draft.revision, graph, refresh_baseline:refresh,
  }, {method:"PUT", ...options});
  const release = draft => api(a, path + "/publish", {
    base_version:draft.base_version, expected_revision:draft.revision, request_id:randomUUID(),
  });
  const source = node("现场验收", 100);
  const first = (await update(await create(), {schema_version:1, nodes:[source], edges:[]})).draft;
  await release(first);
  const draft = await create();
  const existing = draft.graph.nodes[0];
  const proposed = node("等候交接", 480);
  const link = {id:randomUUID(), from:existing.id, to:proposed.id, handoff:"签字验收单"};
  const position = {x:240,y:120};
  const graph = {...draft.graph, nodes:[{...existing, title:"草案中的标题", position}, proposed], edges:[link]};
  const edited = (await update(draft, graph)).draft;
  const issuePath = "/issues/" + existing.issue_id;
  await api(b, issuePath, {due_date:"2027-04-15"}, {method:"PUT"});
  const refreshed = (await update(edited, edited.graph, true)).draft;
  const saved = refreshed.graph.nodes.find(n => n.id === existing.id);
  assert.equal(saved.title, "草案中的标题");
  assert.equal(saved.due_date, "2027-04-15");
  assert.equal(saved.baseline.due_date, saved.due_date);
  assert.deepEqual(saved.position, position);
  assert.ok(refreshed.graph.nodes.some(n => n.id === proposed.id && !n.issue_id));
  assert.deepEqual(refreshed.graph.edges, [link]);
  assert.equal((await api(a, issuePath)).title, source.title);
  assert.equal((await api(a, "/issues?project_id=" + project.id)).total, 1);
  await api(b, issuePath, {title:"负责人修订标题"}, {method:"PUT"});
  await update(refreshed, refreshed.graph, true, {denied:[409]});
  const stored = (await api(a, path + "/draft")).draft;
  assert.equal(stored.revision, refreshed.revision);
  assert.deepEqual(stored.graph, refreshed.graph);
  assert.equal((await api(a, path + "/versions")).versions.length, 1);
  const resolved = {...stored.graph, nodes:stored.graph.nodes.map(n =>
    n.id === existing.id ? {...n, title:"负责人修订标题"} : n)};
  const finalDraft = (await update(stored, resolved, true)).draft;
  await release(finalDraft);
  assert.equal((await api(a, path + "/versions")).versions.length, 2);
  assert.equal((await api(a, "/issues?project_id=" + project.id)).total, 2);
  console.log("PASS 双身份同步任务最新内容保留草案标题、布局、依赖与拟新增节点，同字段冲突回滚，解决后发布 V2 才创建任务");
}

const handbookProject = await api(a,"/projects",{title:"弱网上传项目"});
const handbookTasks = [];
for (const [title,status] of [["修复弱网上传重试","in_progress"],["验证断网恢复后可重试","done"]]) {
  handbookTasks.push(await api(a,"/issues",{title,status,project_id:handbookProject.id,suppress_run:true}));
}
const progressQuery = await ask("查看「弱网上传项目」的整体进度");
const idsFromResult = response => response.result.evidence.map(record => record.objectId).sort();
assert.deepEqual(idsFromResult(progressQuery),handbookTasks.map(task=>task.id).sort());
const justDone = await ask("只看已完成");
assert.deepEqual(idsFromResult(justDone),[handbookTasks[1].id]);
const reloadedAnswer = await api(a,"/workbench/messages/"+justDone.id);
assert.deepEqual(idsFromResult(reloadedAnswer),[handbookTasks[1].id]);
await api(b,"/workbench/messages/"+justDone.id,undefined,{denied:[403,404]});
console.log("PASS 新团队手册原句查询真实项目、同会话追问只看已完成、重读取与第三人隔离（模型 Mock）");

{
  const project = await api(a,"/projects",{title:"纳入现有任务 "+stamp});
  const path = "/projects/"+project.id+"/blueprint";
  const draft = (await api(a,path+"/draft",{})).draft;
  const source = await api(a,"/issues",{title:"负责人查验",description:"初版交付说明",suppress_run:true});
  const resource = "/issues/"+source.id;
  const contract = {title:source.title,requirements:source.description,assignee_type:"",assignee_id:"",due_date:""};
  const item = {
    id:randomUUID(),issue_id:source.id,position:{x:80,y:80},...contract,
    baseline:{...contract,status:source.status,description:source.description,project_id:""},
  };
  const save = (nodes,options = {}) => api(a,path+"/draft",{
    expected_revision:draft.revision,graph:{...draft.graph,nodes},
  },{method:"PUT",...options});
  await api(b,resource,{title:"负责人已校对",suppress_run:true},{method:"PUT"});
  await save([{...item,title:"草案另拟的标题"}],{denied:[409]});
  const unchanged = (await api(a,path+"/draft")).draft;
  assert.equal(unchanged.revision,draft.revision);
  assert.deepEqual(unchanged.graph,draft.graph);
  await save([item,{...item,id:randomUUID()}],{denied:[422]});
  const changed = (await save([{...item,requirements:"新增交付证据"}])).draft;
  const [imported] = changed.graph.nodes;
  assert.equal(imported.title,"负责人已校对");
  assert.equal(imported.baseline.title,"负责人已校对");
  assert.equal(imported.requirements,"新增交付证据");
  assert.equal(imported.baseline.requirements,"初版交付说明");
  assert.equal((await api(b,resource)).project_id,null);
  const confirmation = {expected_revision:changed.revision,base_version:changed.base_version,request_id:randomUUID()};
  const version = await api(a,path+"/publish",confirmation);
  assert.equal((await api(a,path+"/publish",confirmation)).id,version.id);
  assert.deepEqual(version.graph.nodes.map(n=>n.issue_id),[source.id]);
  const live = await api(b,resource);
  assert.equal(live.project_id,project.id);
  assert.equal(live.title,"负责人已校对");
  assert.match(live.description,/新增交付证据/);
  assert.equal((await api(a,"/issues?project_id="+project.id)).total,1);
  console.log("PASS 首次纳入已有任务时双身份同字段冲突回滚，不同字段合并并保留新基线，重复纳入被拒，重复发布只关联原任务");
}
