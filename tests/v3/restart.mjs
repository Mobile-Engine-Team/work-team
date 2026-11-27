// Stop and restart the lab services only. Keep account credentials in this process.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

assert.equal(process.env.WORKBENCH_TEST_LAB,"1","需要独立测试端口 WORKBENCH_TEST_LAB=1");
assert.ok(process.env.WORKBENCH_RUNTIME,"请指定已准备好的隔离运行目录");
const launcher=resolve(process.env.MW_V3_DEPLOY_ROOT || ".", "scripts/local");
const service=(action,unit)=>execFileSync(launcher,[action,unit],{stdio:"inherit"});
const client=async(route,body,account,workspace)=>{
  const response=await fetch("http://127.0.0.1:19115"+route,{
    method:body===undefined?"GET":"POST",
    headers:{connection:"close","Content-Type":"application/json",...(account&&{authorization:"Bearer "+account.token}),...(workspace&&{"X-Workspace-ID":workspace})},
    body:body===undefined?undefined:JSON.stringify(body),
  });
  assert.ok(response.ok,route+" HTTP "+response.status);
  return response.headers.get("content-type")?.includes("json") ? response.json() : response.text();
};
service("start","api");
const stamp=randomUUID().slice(0,8);
const owner={username:"restarta"+stamp,password:randomUUID()};
const member={username:"restartb"+stamp,password:randomUUID()};
const a=await client("/auth/password/register",owner),b=await client("/auth/password/register",member);
const {id:ws}=await client("/api/workspaces",{name:"持久化回放 "+stamp,slug:"restart-"+stamp},a);
const api=(acc,route,body)=>client("/api"+route,body,acc,ws);
const invitation=await api(a,"/workspaces/"+ws+"/members",{email:b.user.email,role:"member"});
await api(b,"/invitations/"+invitation.id+"/accept",{});
const project=await api(a,"/projects",{title:"重启后复核"});
const issue=await api(b,"/issues",{title:"持久任务",status:"todo",project_id:project.id,suppress_run:true});
const room=await api(a,"/workbench/rooms",{title:"持久化对话",kind:"direct",members:[b.user.id],project_id:project.id});
const contents = ["数据库原始字节", "", "第二份原件"];
const request = {
  content: "重启后读取原始附件",
  files: contents.map(text => ({filename:"恢复.txt", bytes:Buffer.from(text).toString("base64")})),
  request_id: randomUUID(),
};
const message=await api(b,"/workbench/rooms/"+room.id+"/messages",request);
const originalFiles = (await api(b, "/workbench/rooms/"+room.id)).messages.find(m=>m.id===message.id).files;
assert.equal(new Set(originalFiles.map(f=>f.id)).size, contents.length);
const previousPid=(await client("/health")).pid;
service("stop","api");
service("stop","db");
service("start","api");
assert.notEqual((await client("/health")).pid,previousPid);
const login=await client("/auth/password/login",member);
assert.equal(login.user.id,b.user.id);
assert.equal((await api(login,"/issues/"+issue.id)).project_id,project.id);
const detail=await api(login,"/workbench/rooms/"+room.id);
assert.equal(detail.project_id,project.id);
assert.ok(detail.members.includes(a.user.id));
assert.equal(detail.messages.find(m=>m.id===message.id).content,request.content);
const restored = detail.messages.find(m=>m.id===message.id).files;
assert.deepEqual(restored,originalFiles);
for (const [position, file] of restored.entries()) {
  assert.equal(await api(login,"/workbench/room-files/"+file.id),contents[position]);
}
assert.equal((await api(login,"/workbench/rooms/"+room.id+"/messages",request)).id,message.id);
assert.equal((await api(login,"/workbench/rooms/"+room.id)).messages.length,1);
console.log("PASS 关闭 API 与 PostgreSQL 后重新启动，重新登录后成员、项目、任务、对话原文、同名多附件 ID 与原字节、零字节文件及幂等回执保留");


// Exercise the missing-credentials branch only in an isolated, unconfigured lab.
if (!existsSync(resolve(process.env.WORKBENCH_RUNTIME,"model.private.json"))) {
  service("stop","api");
  try {
    execFileSync(launcher,["start","api"],{stdio:"inherit",env:{...process.env,MOBILEWORK_WORK_ADAPTER:""}});
    const plain=await client("/auth/password/login",member);
    const state=await api(plain,"/workbench");
    assert.equal(state.mock,false);
    assert.equal(state.modelReady,false);
    const readiness=await api(plain,"/workbench/model-readiness");
    assert.deepEqual(readiness,{runtimeStatus:state.runtimeStatus,modelReady:false});
    const conversation=await api(plain,"/workbench/conversations",{title:"缺模型隔离验收"});
    if(process.env.MW_V3_VERIFY_OFFLINE_UI==="1") {
      const {chromium}=await import("playwright");
      service("start","a");
      const browser=await chromium.launch({channel:process.env.MW_CHROME_CHANNEL || "chrome"});
      try {
        const page=await browser.newPage({viewport:{width:1440,height:900}});
        await page.goto(readFileSync(resolve(process.env.WORKBENCH_RUNTIME,"a","entry.private"),"utf8").trim());
        await page.getByRole("textbox",{name:"账号",exact:true}).fill(member.username);
        await page.locator("input[type=password]").fill(member.password);
        await page.locator("form button").click();
        await page.getByRole("combobox",{name:"工作区"}).waitFor();
        await page.getByRole("button",{name:"智能体",exact:true}).click();
        const work=page.locator(".directory-card").filter({has:page.getByRole("heading",{name:"Work",exact:true})});
        await work.getByText("离线",{exact:true}).waitFor();
        await page.getByRole("button",{name:"协作空间",exact:true}).click();
        await page.getByText("其中 0 个当前在线",{exact:true}).waitFor();
        console.log("PASS 未配置模型的工作区中，智能体目录显示 Work 离线，协作空间在线计数为零");
      } finally {await browser.close();}
    }
    const post=await fetch("http://127.0.0.1:19115/api/workbench/messages",{
      method:"POST",headers:{"Content-Type":"application/json",authorization:"Bearer "+plain.token,"X-Workspace-ID":ws},
      body:JSON.stringify({conversationId:conversation.id,requestId:randomUUID(),prompt:"写一份回归测试说明"}),
    });
    assert.equal(post.status,503);
    const detail=await post.json();assert.ok(detail.error);
    assert.equal((await api(plain,"/workbench")).messages.filter(m=>m.conversation_id===conversation.id || m.conversationId===conversation.id).length,0);
    const manual=await api(plain,"/issues",{title:"无模型时的手动任务",project_id:project.id,suppress_run:true});
    assert.equal((await api(plain,"/issues/"+manual.id)).project_id,project.id);
    console.log("PASS 关闭 Mock 且缺少模型凭据，Work 生成返回 503、无成功消息，手动项目任务仍可保存和重读");
  } finally {
    service("stop","api");service("start","api");
  }
}
