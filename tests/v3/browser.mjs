import {verifyBlueprintCandidates} from "./blueprint-candidates.mjs";
import {verifyCanvasGestures} from "./blueprint-gestures.mjs";
import {verifyTaskInspector} from "./task-inspector.mjs";
import {verifyBlueprintRefresh,verifyHistoricalTaskMembership} from "./blueprint-refresh.mjs";
import {captureThemeColors,captureRoomSettings,captureSwimlane,captureTaskControls,captureHandoff,captureFiles,captureBlueprintCandidates,captureVersionHistory,capturePublishPreview,captureTaskDetail,captureManagementGeometry,captureDirectoryGeometry,captureRuntimeGeometry,captureRuntimePanel,captureProjectControls} from "./layout-geometry.mjs";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const runtime = resolve(process.env.WORKBENCH_RUNTIME || ".local/v2-runtime");
const artifacts = resolve(process.env.MW_V3_EVIDENCE || ".local/v3-browser");
await mkdir(artifacts, { recursive: true });
const native = process.env.MW_V3_NATIVE_APP;
const apps = [];
const browser = await chromium.launch({
  channel: process.env.MW_CHROME_CHANNEL || "chrome",
});
const stamp = randomUUID().slice(0, 8);
const btn = (p, name) =>
  p.getByRole("button", { name, exact: typeof name === "string" });
const heading = (p, name) => p.getByRole("heading", { name, exact: true });
async function measureManagement(page,section) {
  const metrics = await captureManagementGeometry(page, section, artifacts);
  assert.deepEqual(metrics[".tm-settings-heading"][0],[413,162,814,50]);
  if(section==="members") {
    assert.deepEqual(metrics[".tm-member-toolbar"][0],[413,234,814,40]);
    assert.deepEqual(metrics[".tm-member-row"][0],[414,295,812,84]);
  } else {
    assert.deepEqual(metrics[".tm-avatar-editor"][0],[436,253,768,64]);
    assert.deepEqual(metrics[".tm-field>input"][0],[610,354,594,42]);
    assert.deepEqual(metrics[".tm-field>textarea"],[[610,433,594,88],[610,558,594,110]]);
  }
}
async function checkPanel(page, selector, expected) {
  const geometry = await page.locator(selector).last().evaluate(async el=>{
    await Promise.all(el.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));
    const box=el.getBoundingClientRect(), header=el.querySelector(':scope > [data-slot="dialog-header"], :scope > header');
    const overlay=el.parentElement?.querySelector('[data-slot="dialog-overlay"]');
    return {x:Math.round(box.x),y:Math.round(box.y),width:Math.round(box.width),height:Math.round(box.height),
      header:header && Math.round(header.getBoundingClientRect().height),blur:overlay && getComputedStyle(overlay).backdropFilter,
      scrim:overlay && getComputedStyle(overlay).backgroundColor};
  });
  for(const [key,value] of Object.entries(expected)) assert.equal(geometry[key],value,selector+" "+key+" "+JSON.stringify(geometry));
}
const pages = [];
try {
  for (const profile of ["a", "b", "c"]) {
    let p;
    if (native && profile !== "c") {
      const port = profile === "a" ? 19366 : 19367,
        endpoint = "http://127.0.0.1:" + port;
      assert.equal(
        await fetch(endpoint + "/json/version").then(
          () => true,
          () => false,
        ),
        false,
        "验收调试端口已占用",
      );
      execFileSync("/usr/bin/open", [
        "-n",
        "-a",
        resolve(native),
        "--args",
        "--workbench-isolated-replay",
        "--workbench-fixture",
        "--workbench-work-mock",
        "--workbench-profile=" + profile,
        "--remote-debugging-address=127.0.0.1",
        "--remote-debugging-port=" + port,
      ]);
      let ready = false;
      for (let i = 0; i < 480 && !ready; i++) {
        await delay(250);
        ready = await fetch(endpoint + "/json/list")
          .then((r) => r.json())
          .then(
            (tabs) =>
              tabs.some(
                (t) =>
                  t.type === "page" &&
                  t.url.startsWith("http://127.0.0.1:1911"),
              ),
            () => false,
          );
      }
      assert.ok(ready, "桌面启动超时");
      const app = await chromium.connectOverCDP(endpoint);
      apps.push(app);
      p = app
        .contexts()[0]
        .pages()
        .find((page) => page.url().startsWith("http://127.0.0.1:1911"));
      await p.setViewportSize({ width: 1440, height: 900 });
    } else {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      p = await ctx.newPage();
      await p.goto(
        (
          await readFile(
            resolve(
              runtime,
              ...(native ? ["isolated-replay"] : []),
              profile === "c" ? "b" : profile,
              "entry.private",
            ),
            "utf8",
          )
        ).trim(),
      );
    }
    p.setDefaultTimeout(15000);
    p.on("pageerror", (error) => console.error("PAGE", error.message));
    if (await btn(p, "账户菜单").isVisible()) {
      await btn(p, "账户菜单").click();
      await btn(p, "退出账号").click();
    }
    await btn(p, /注册账号/).click();
    await p
      .getByRole("textbox", { name: "账号", exact: true })
      .fill("ui" + profile + stamp);
    const pw = randomUUID();
    for (const field of await p.locator("input[type=password]").all())
      await field.fill(pw);
    await p.locator("form button").click();
    await p.getByRole("combobox", { name: "工作区" }).waitFor();
    pages.push(p);
  }
  const [a, b, c] = pages;
  await a.getByRole("combobox", { name: "工作区" }).click();
  await btn(a, "创建团队").click();
  let dialog = a.getByRole("dialog").last();
  assert.equal(await btn(dialog, "创建团队").isDisabled(), true);
  await dialog
    .getByRole("textbox")
    .first()
    .fill("联调团队" + stamp);
  await btn(dialog, "使用绿色头像").click();
  await btn(dialog, "创建团队").click();
  await btn(a.getByRole("dialog").last(), "进入团队").click();
  await heading(a, "还没有项目").waitFor();
  await btn(a, "协作空间").click();
  await a.locator(".space-avatar img").waitFor();
  await btn(a, "编辑空间资料").click();
  dialog = a.getByRole("dialog").last();
  await dialog.evaluate(async el=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})))});
  const originalTitle = await dialog.getByLabel("团队名称",{exact:true}).inputValue();
  assert.equal(originalTitle,"联调团队"+stamp);
  await dialog.getByLabel("团队名称",{exact:true}).fill("");
  assert.equal(await dialog.getByLabel("团队名称",{exact:true}).inputValue(),"");
  assert.equal(await btn(dialog,"保存修改").isDisabled(),true);
  await dialog.getByRole("button",{name:/^Close$|^关闭$/}).click();
  const discard=a.getByRole("dialog",{name:"放弃未保存的修改"});
  await btn(discard,"取消").click();await discard.waitFor({state:"hidden"});
  await dialog.getByLabel("团队名称",{exact:true}).fill(originalTitle+"草稿");
  await dialog.getByRole("button",{name:/^Close$|^关闭$/}).click();await btn(discard,"放弃修改").click();
  await btn(a,"编辑空间资料").click();
  assert.equal(await dialog.getByLabel("团队名称",{exact:true}).inputValue(),originalTitle);
  const upload = dialog.getByLabel("上传团队头像");
  await upload.setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("x"),
  });
  await dialog.getByText(/请选择 5 MB/).waitFor();
  const png = await a.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 16, 16);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await upload.setInputFiles({
    name: "team.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await dialog.locator('img[src^="data:image/webp"]').waitFor();
  await btn(dialog, "保存修改").click();
  await dialog.getByText("修改已保存",{exact:true}).waitFor();
  await a.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await a.reload();
  await a.locator('.space-avatar img[src^="data:image/webp"]').waitFor();
  assert.equal(
    await a
      .locator(".space-metrics")
      .evaluate((el) => getComputedStyle(el).display),
    "grid",
  );
  await a.screenshot({ path: resolve(artifacts, "space.png") });
  await btn(a, "邀请成员").click();
  dialog = a.getByRole("dialog",{name:"邀请成员",exact:true});
  await dialog.getByRole("textbox").fill("invalid");
  await btn(dialog,"创建邀请").click();await dialog.getByText("请输入有效邮箱").waitFor();
  await dialog.getByRole("textbox").fill("uia"+stamp+"@demo.mobilework.invalid");
  await btn(dialog,"创建邀请").click();await dialog.getByText("邮箱已是成员或已有待接受邀请").waitFor();
  await dialog
    .getByRole("textbox")
    .fill(
      ["b", "c", "c"]
        .map((role) => "ui" + role + stamp + "@demo.mobilework.invalid")
        .join("\n"),
    );
  await btn(dialog, "创建邀请").click();
  await b.getByRole("button", { name: /接受邀请/ }).click();
  await b
    .getByRole("combobox", { name: "工作区" })
    .filter({ hasText: "联调团队" })
    .waitFor();
  const cBell=c.getByRole("button",{name:/^通知，/});
  await cBell.click();
  const cCenter=c.getByRole("dialog",{name:"通知中心"});
  await cCenter.locator(".mw-notice-open").filter({hasText:"团队邀请"}).waitFor();
  await btn(cCenter,"关闭通知").click();
  await cBell.click();
  await cCenter.locator(".mw-notice-open").filter({hasText:"团队邀请"}).click();
  const inviteLink=c.getByRole("dialog",{name:"团队邀请"});
  await inviteLink.getByText("联调团队"+stamp,{exact:true}).waitFor();
  const invitationURL=c.url();
  await c.reload();
  await btn(inviteLink,"接受并加入").click();
  await c
    .getByRole("combobox", { name: "工作区" })
    .filter({ hasText: "联调团队" })
    .waitFor();
  await a.keyboard.press("Escape");
  const aBell=a.getByRole("button",{name:/^通知，/});await aBell.click();
  const center=a.getByRole("dialog",{name:"通知中心"});
  await center.locator(".mw-notice-item").filter({hasText:"uic"+stamp}).first().waitFor();
  await center.locator(".mw-notice-item").filter({hasText:"uic"+stamp}).first().getByRole("button",{name:/标为已读/}).click();
  await btn(center,"全部已读").click();
  await center.getByText("没有未读通知").waitFor();
  await center.getByRole("tab",{name:"全部",exact:true}).click();
  await center.locator(".mw-notice-item").filter({hasText:"uic"+stamp}).first().waitFor();
  await btn(center,"关闭通知").click();
  await c.goto(invitationURL);await inviteLink.getByText("已接受邀请",{exact:true}).waitFor();
  await btn(inviteLink,"进入团队").click();
  await c.getByRole("combobox",{name:"工作区"}).filter({hasText:"联调团队"+stamp}).waitFor();
  console.log("PASS 邀请从个人通知进入指定链接、刷新后接受、发起人单条及全部已读、历史和已接受链接");
  await btn(c, "协作空间").click();
  await btn(c, "查看空间资料").click();
  const readonly = c.getByRole("dialog").last();
  assert.equal(await readonly.getByRole("textbox").first().isDisabled(), true);
  await c.keyboard.press("Escape");
  await btn(a,"管理成员").click();
  const manager=a.getByRole("dialog",{name:"团队设置"});
  const memberSearch=manager.getByLabel("搜索姓名或邮箱");
  await memberSearch.fill("无此成员"+stamp);await manager.getByText("没有找到成员").waitFor();
  await memberSearch.fill("uic"+stamp);
  await manager.getByRole("button",{name:/管理成员 uic/}).click();
  await btn(manager,"设为管理员").click();
  await manager.locator(".tm-member-role").getByText("管理员",{exact:true}).waitFor();
  await manager.getByRole("button",{name:/管理成员 uic/}).click();await btn(manager,"设为成员").click();
  await manager.locator(".tm-member-role").getByText("成员",{exact:true}).waitFor();
  await manager.getByRole("button",{name:/管理成员 uic/}).click();await btn(manager,"移出团队").click();
  await btn(a.getByRole("dialog",{name:"移出团队"}),"取消").click();
  await manager.getByRole("tab",{name:/邀请链接/}).click();await manager.getByText("暂无邀请链接").waitFor();
  await btn(manager,"创建邀请链接").click();await btn(manager,"复制链接").waitFor();
  const linkMenu=manager.getByRole("button",{name:/管理邀请链接/});
  await linkMenu.click();await btn(manager,"停用链接").click();await manager.getByText("已停用",{exact:true}).waitFor();
  assert.equal(await btn(manager,"复制链接").isDisabled(),true);
  await linkMenu.click();await btn(manager,"启用链接").click();
  await manager.locator(".tm-link-row small").filter({hasText:"到期"}).waitFor();
  await linkMenu.click();await btn(manager,"删除链接").click();await btn(a.getByRole("dialog",{name:"删除链接"}),"取消").click();
  await btn(manager,"删除链接").click();await btn(a.getByRole("dialog",{name:"删除链接"}),"确认").click();
  await manager.getByText("暂无邀请链接").waitFor();await a.keyboard.press("Escape");
  console.log("PASS 团队设置放弃草稿、头像保存、成员搜索和升降权、取消移除、邀请格式和重复、通用链接启停与删除");
  if (native) {
    await btn(a, "账户菜单").click();
    await btn(a, "运行时").click();
    await btn(a, "Qoder Cloud Agents").click();
    dialog = a.getByRole("dialog").last();
    await dialog.getByLabel("访问令牌").fill("invalid-format");
    await btn(dialog, "验证并读取环境").click();
    await dialog.getByText("请输入以 pt- 开头的有效令牌").waitFor();
    await btn(dialog, "取消").click();
    await btn(a, "Qoder Cloud Agents").click();
    dialog = a.getByRole("dialog").last();
    assert.equal(await dialog.getByLabel("访问令牌").inputValue(), "");
    await btn(dialog, "取消").click();
    const runtimeUI = a.getByRole("region",{name:"运行时目录"});
    const filter = runtimeUI.getByLabel("筛选运行时");
    await filter.selectOption("offline");
    await runtimeUI.getByText("没有符合此状态的机器").waitFor();
    await filter.selectOption("all");
    await runtimeUI.locator('summary[aria-label="添加运行时"]').click();
    await btn(runtimeUI,"添加自定义运行时").click();
    let profileDialog = a.getByRole("dialog",{name:"添加自定义运行时"});
    await btn(profileDialog,"下一步").click();
    await btn(profileDialog,"保存配置").click();
    await profileDialog.getByText("请填写名称和命令").waitFor();
    await profileDialog.getByLabel("配置名称").fill("验收配置"+stamp);
    await profileDialog.getByLabel("启动命令").fill("invalid command");
    await btn(profileDialog,"保存配置").click();
    await profileDialog.getByText("启动命令只接受一个可执行文件，参数请另填").waitFor();
    await profileDialog.getByLabel("启动命令").fill("mw-acceptance-cli");
    await btn(profileDialog,"保存配置").click();
    await profileDialog.waitFor({state:"hidden"});
    await a.reload();
    await btn(runtimeUI,"验收配置"+stamp).click();
    profileDialog=a.getByRole("dialog",{name:"编辑自定义运行时"});
    assert.equal(await profileDialog.getByLabel("启动命令").inputValue(),"mw-acceptance-cli");
    await btn(profileDialog,"移除配置").click();
    await btn(a.getByRole("dialog",{name:"移除运行时配置"}),"取消").click();
    await btn(profileDialog,"移除配置").click();
    await btn(a.getByRole("dialog",{name:"移除运行时配置"}),"确认移除").click();
    await profileDialog.waitFor({state:"hidden"});
    await btn(runtimeUI,"验收配置"+stamp).waitFor({state:"hidden"});
    await runtimeUI.locator('summary[aria-label="添加运行时"]').click();
    await btn(a, "启用本机执行端").click();
    const stop = btn(a, "停用本机执行端");
    await stop.waitFor({ timeout: 60000 });
    try {
      await btn(a,"协作空间").click();
      await heading(a,"协作空间").waitFor();
      const machineRow=runtimeUI.locator(".rt-machine-row").first();
      await machineRow.waitFor({timeout:45000});
      await a.keyboard.press("Escape");
      await captureRuntimeGeometry(a, artifacts);
      await captureRuntimePanel(a, runtimeUI, resolve(artifacts,"runtime-directory.png"));
      await machineRow.click();
      await runtimeUI.locator(".team-cli-row").first().waitFor({timeout:45000});
      await captureRuntimePanel(a, runtimeUI, resolve(artifacts,"runtime-machine.png"));
      await btn(runtimeUI,"切换属性面板").click();
      assert.equal(await runtimeUI.locator(".rt-properties").count(),0);
      await btn(runtimeUI,"切换属性面板").click();
      const daemonId = new URLSearchParams(new URL(a.url()).hash.split("?")[1]).get("machine") || new URL(a.url()).searchParams.get("machine");
      assert.ok(daemonId);
      await btn(runtimeUI,"查看日志").click();
      const log = a.getByRole("dialog",{name:"守护进程日志"});
      await log.locator(".mw-runtime-log li").first().waitFor();
      const refresh = a.waitForResponse(res => res.url().endsWith("/api/workbench/desktop") && res.request().postDataJSON()?.action==="team:daemonLogs");
      await btn(log,"刷新").click();
      const refreshed = await (await refresh).json();
      assert.equal(refreshed.ok,true);
      assert.deepEqual(Object.keys(refreshed.entries[0]).sort(),["event","level","time"]);
      await btn(log,"关闭").click();
      const denied = await b.evaluate(async daemonId => (await fetch("/api/workbench/desktop", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"team:daemonLogs",payload:{daemonId}})
      })).json(),daemonId);
      assert.equal(denied.ok,false);
      assert.equal(denied.entries,undefined);
      const receipt = action => a.waitForResponse(res => res.url().endsWith("/api/workbench/desktop") && res.request().postDataJSON()?.action===action);
      const stopped=receipt("team:stopDaemon"), started=receipt("team:enableDaemon");
      await btn(runtimeUI,"重启本机执行端").click();
      assert.equal((await (await stopped).json()).state,"stopped");
      const restarted=await (await started).json();
      assert.equal(restarted.daemonId,daemonId);
      assert.ok(["starting","running"].includes(restarted.state));
      await btn(runtimeUI,"停用本机执行端").waitFor();
      console.log("PASS 本机守护进程状态日志、刷新与成员隔离，重启返回同一台机器的停止及启动回执");
      await runtimeUI.getByLabel("机器操作").click();await btn(runtimeUI,"重命名机器").click();
      const rename=a.getByRole("dialog",{name:"重命名机器"});
      await rename.getByLabel("机器名称").fill("验收机器"+stamp);
      await btn(rename,"保存").click();
      await runtimeUI.getByRole("heading",{name:new RegExp("^验收机器"+stamp)}).waitFor();
      await a.reload();await runtimeUI.getByRole("heading",{name:new RegExp("^验收机器"+stamp)}).waitFor();
      await runtimeUI.getByLabel("机器操作").click();await btn(runtimeUI,"重命名机器").click();await rename.getByLabel("机器名称").fill("");
      await btn(rename,"保存").click();await rename.waitFor({state:"hidden"});
      await runtimeUI.getByRole("heading",{name:new RegExp("^验收机器"+stamp)}).waitFor({state:"hidden"});
      await runtimeUI.locator(".team-cli-row").filter({hasText:/codex/i}).first().click();
      await runtimeUI.getByLabel("运行时并发上限").waitFor();
      await captureRuntimePanel(a, runtimeUI, resolve(artifacts,"runtime-settings.png"));
      await runtimeUI.getByLabel("运行时并发上限").fill("51");await btn(runtimeUI,"保存并发上限").click();
      await runtimeUI.getByText("请输入 1 至 50 的整数，或留空取消限制").waitFor();
      await runtimeUI.getByLabel("运行时并发上限").fill("3");await btn(runtimeUI,"保存并发上限").click();
      await a.waitForFunction(()=>document.querySelector('input[aria-label="运行时并发上限"]')?.parentElement && Array.from(document.querySelectorAll("button")).some(b=>b.textContent==="保存并发上限" && b.disabled));
      await a.reload();assert.equal(await runtimeUI.getByLabel("运行时并发上限").inputValue(),"3");
      await runtimeUI.getByRole("tab",{name:"智能体"}).click();await runtimeUI.getByText("暂无关联智能体").waitFor();
      await runtimeUI.getByRole("tab",{name:"用量"}).click();await runtimeUI.getByText("此期间没有用量记录").waitFor();
      await runtimeUI.getByLabel("统计周期").selectOption("30");
      await btn(runtimeUI,"运行时").click();await filter.selectOption("online");await machineRow.waitFor();
      console.log("PASS 运行时目录在线离线筛选、工作区自定义配置增删、机器改名与恢复、执行端并发校验及用量回读");
      await a.screenshot({ path: resolve(artifacts, "runtime.png") });
      await btn(a, "智能体").click();
      const searchAgents = a.getByRole("textbox", { name: "搜索智能体" });
      await searchAgents.fill("完全无匹配" + stamp);
      await heading(a, "没有找到匹配结果").waitFor();
      await btn(a, "清除筛选").click();
      await btn(a, "已归档").click();
      await heading(a, "暂无已归档智能体").waitFor();
      await btn(a, "全部智能体").click();
      await btn(a, "列表视图").click();
      await a
        .locator(".directory-table")
        .getByRole("button", { name: "Work", exact: true })
        .waitFor();
      await btn(a, "卡片视图").click();
      await a.screenshot({ path: resolve(artifacts, "agent-directory.png") });
      await btn(a, "创建智能体").first().click();
      dialog = a.getByRole("dialog").last();
      await dialog.getByRole("combobox", { name: "选择执行端" }).click();
      await a.getByRole("option", { name: /Codex/i }).first().click();
      await dialog
        .getByRole("textbox", { name: "名称", exact: true })
        .fill("桌面验收员" + stamp);
      await dialog.getByRole("spinbutton", { name: "并发任务数" }).fill("2");
      await btn(dialog, "添加对话开场").click();
      await dialog.getByLabel("开场名称 1").fill("核对回执");
      await dialog.getByLabel("开场提示 1").fill("请核对实际运行回执");
      await dialog.getByRole("combobox", { name: "访问范围" }).click();
      await a.getByRole("option", { name: "整个协作空间" }).click();
      await btn(dialog, "保存").click();
      await dialog.waitFor({ state: "hidden" });
      await a
        .locator(".directory-card")
        .filter({ hasText: "桌面验收员" + stamp })
        .click();
      await btn(a,"环境变量").click();
      const environment=a.getByRole("dialog",{name:"环境与参数 · 桌面验收员"+stamp});
      await btn(environment,"解锁环境变量").click();
      await btn(environment,"添加变量").click();
      await environment.getByLabel("变量名",{exact:true}).fill("1BAD");
      await btn(environment,"保存").click();
      await environment.getByText(/变量名应唯一/).waitFor();
      await environment.getByLabel("变量名",{exact:true}).fill("MW_VALIDATION");
      await environment.getByLabel("变量值",{exact:true}).fill("acceptance-only");
      await btn(environment,"添加变量").click();
      await environment.getByLabel("变量名",{exact:true}).last().fill("MW_VALIDATION");
      await btn(environment,"保存").click();await environment.getByText(/变量名应唯一/).waitFor();
      await btn(environment,"移除").last().click();await btn(environment,"保存").click();
      await environment.waitFor({state:"hidden"});
      await btn(a,"环境变量").click();await btn(environment,"解锁环境变量").click();
      assert.equal(await environment.getByLabel("变量值",{exact:true}).inputValue(),"acceptance-only");
      await btn(environment,"移除").click();
      await btn(environment,"关闭").click();
      await btn(a.getByRole("dialog",{name:"保存更改？"}),"继续编辑").click();
      await btn(environment,"保存").click();await environment.waitFor({state:"hidden"});
      console.log("PASS 智能体环境变量解锁、非法名和重名拒绝、保存后重新读取、移除前继续编辑");
      const agentName = "桌面验收员" + stamp;
      const archiveDialog = a.getByRole("dialog",{name:"归档智能体",exact:true});
      await btn(a,"归档智能体").click();
      await archiveDialog.getByText("确定归档“"+agentName+"”吗？",{exact:true}).waitFor();
      await btn(archiveDialog,"取消").click();
      await heading(a,agentName).waitFor();
      await btn(a,"归档智能体").click();
      await btn(archiveDialog,"确认归档").click();
      const atScope = scope => url => new URLSearchParams(url.hash.split("?")[1]).get("scope") === scope;
      await a.waitForURL(atScope("已归档"));
      const archivedCard = a.locator(".directory-card").filter({hasText:agentName});
      await archivedCard.waitFor();
      await a.reload();
      await archivedCard.click();
      await btn(a,"恢复").click();
      await a.waitForURL(atScope("全部智能体"));
      await archivedCard.click();
      await btn(a,"发起对话").waitFor();
      console.log("PASS 自建智能体取消归档、确认归档、刷新已归档目录、恢复后重新发起对话");
      await btn(a, "发起对话").click();
      const msg = a.getByRole("textbox", { name: "会话消息" });
      await btn(a, "核对回执").click();
      assert.equal(await msg.inputValue(), "请核对实际运行回执");
      await a.locator(".team-upload input[type=file]").setInputFiles({name:"智能体验收.txt",mimeType:"text/plain",buffer:Buffer.from("仅本人可读")});
      await a.locator(".team-file-chip").filter({hasText:"智能体验收.txt"}).waitFor();
      await msg.fill("核对回执");
      await btn(a, "发送").click();
      await a
        .getByText("WORKBENCH_FIXTURE_OK", { exact: true })
        .waitFor({ timeout: 90000 });
      await a.screenshot({ path: resolve(artifacts, "agent-receipt.png") });
      await a.locator(".v3-chat-message").getByRole("button",{name:"智能体验收.txt"}).click();
      const agentFile=a.getByRole("dialog",{name:"智能体验收.txt"});
      await agentFile.getByText(/15 字节/).waitFor();
      await btn(agentFile,"查看来源").click();
      await a.locator(".v3-chat-message.team-located").getByText("智能体验收.txt",{exact:true}).waitFor();
      await a.getByText("WORKBENCH_FIXTURE_OK",{exact:true}).waitFor();
    } catch(error) {
      await a.screenshot({path:resolve(artifacts,"agent-flow-failure.png")});
      console.error("智能体桌面流程",error.message);
      throw error;
    } finally {
      if (await a.getByRole("dialog").count()) await a.keyboard.press("Escape");
      if (!(await stop.isVisible())) {
        await btn(a, "账户菜单").click();
        await btn(a, "运行时").click();
      }
      const addMenu=a.locator('.mw-runtime summary[aria-label="添加运行时"]');
      if (!(await stop.isVisible()) && await addMenu.isVisible()) await addMenu.click();
      if (await stop.isVisible()) {
        await stop.click();
        await btn(a, "启用本机执行端").waitFor({ timeout: 45000 });
      }
    }
    console.log(
      "PASS 原生执行端启停、真实注册、创建智能体、CLI 协议进程收到请求并回传结果（执行器 Fixture）",
    );
  }
  if (native) {
    await btn(a, "智能体小队").click();
    await btn(a, "创建小队").first().click();
    dialog = a.getByRole("dialog").last();
    await dialog.getByLabel("小队名称").fill("验收小队" + stamp);
    await dialog.getByLabel("小队指令").fill("先记录证据，再通知团队");
    await dialog.getByRole("combobox", { name: "选择队长" }).click();
    await a.getByRole("option", { name: "桌面验收员" + stamp }).click();
    await btn(dialog, "创建小队").click();
    await heading(a, "验收小队" + stamp).waitFor();
    await a.getByText("先记录证据，再通知团队", { exact: true }).waitFor();
    await btn(a, "添加成员").click();
    dialog = a.getByRole("dialog").last();
    await dialog.getByRole("combobox").click();
    await a.getByRole("option", { name: new RegExp("uib" + stamp) }).click();
    await dialog.locator("textarea").fill("验收成员");
    await dialog.locator(".team-modal-actions button").last().click();
    await dialog.waitFor({ state: "hidden" });
    await btn(a, "用小队开聊").click();
    await a.getByRole("textbox", { name: "会话消息" }).waitFor();
    await btn(b, "智能体小队").click();
    await b
      .locator(".directory-card")
      .filter({ hasText: "验收小队" + stamp })
      .click();
    await btn(b, "用小队开聊").click();
    await b.getByRole("textbox", { name: "会话消息" }).waitFor();
    assert.equal(
      new URL(a.url()).hash.split("room=")[1],
      new URL(b.url()).hash.split("room=")[1],
    );
    console.log(
      "PASS 在同一空团队创建共享智能体、设置开场和并发、创建混合小队、成员身份进入同一小队会话",
    );
    const squadMessage = "归档前保留的交接记录 " + stamp;
    await b.getByRole("textbox",{name:"会话消息"}).fill(squadMessage);
    await btn(b,"发送消息").click();
    await b.getByText(squadMessage,{exact:true}).first().waitFor();
    await btn(a.getByLabel("空间导航"),"智能体").click();
    await a.locator(".directory-card").filter({hasText:"桌面验收员"+stamp}).click();
    await btn(a,"归档智能体").click();
    const leaderGuard = a.getByRole("dialog",{name:"请先更换小队队长"});
    await leaderGuard.waitFor();
    assert.equal(await btn(leaderGuard,"确认归档").count(),0);
    await btn(leaderGuard,"验收小队"+stamp).click();
    await heading(a,"验收小队"+stamp).waitFor();
    console.log("PASS 在任队长归档前列出受影响小队，点击进入对应小队详情");
    const squadCard = a.locator(".directory-card").filter({hasText:"验收小队"+stamp});
    await btn(a,"归档小队").click();
    const archiveSquad = a.getByRole("dialog",{name:"归档小队"});
    await btn(archiveSquad,"取消").click();
    await heading(a,"验收小队"+stamp).waitFor();
    await btn(a,"归档小队").click();
    await btn(archiveSquad,"确认归档").click();
    await archiveSquad.waitFor({state:"hidden"});
    await heading(a,"智能体小队").waitFor();
    await a.reload();
    await heading(a,"智能体小队").waitFor();
    assert.equal(await squadCard.count(),0);
    await b.reload();
    await b.getByText(squadMessage,{exact:true}).first().waitFor();
    console.log("PASS 小队归档取消、确认后退出活跃目录、刷新后原成员仍能回读归档前的会话消息");
  }
  await btn(a, "全部项目").click();
  await btn(a, "新建项目").first().click();
  dialog = a.getByRole("dialog").last();
  await btn(dialog,"创建项目").click();
  await dialog.getByRole("alert").filter({hasText:"请输入项目名称"}).waitFor();
  await btn(dialog,"取消").click();
  await btn(a,"新建项目").first().click();
  await dialog.getByRole("textbox").first().fill("弱网验收");
  await dialog.getByRole("textbox").last().fill("交付重复请求的回归记录。");
  await dialog.getByRole("button", { name: /^(新建|创建)项目$/ }).click();
  await heading(a, "弱网验收").waitFor();
  await btn(a,"项目设置").click();
  const projectSettings=a.getByRole("dialog",{name:"项目设置"});
  await projectSettings.getByLabel("开始日期").fill("2026-12-04");
  await projectSettings.getByLabel("截止日期").fill("2026-12-02");
  await btn(projectSettings,"保存设置").click();
  await projectSettings.getByRole("alert").filter({hasText:"截止日期不能早于开始日期"}).waitFor();
  await projectSettings.getByLabel("截止日期").fill("2026-12-05");
  await projectSettings.getByRole("combobox",{name:"项目负责人"}).click();
  await a.getByRole("option",{name:"无负责人"}).click();
  await btn(projectSettings,"保存设置").click();
  await projectSettings.waitFor({state:"hidden"});
  await a.reload();await btn(a,"项目设置").click();
  assert.match(await projectSettings.getByRole("combobox",{name:"项目负责人"}).innerText(),/无负责人/);
  assert.equal(await projectSettings.getByLabel("截止日期").inputValue(),"2026-12-05");
  await btn(projectSettings,"删除项目").click();await btn(a.getByRole("dialog",{name:"删除项目"}),"取消").click();
  await btn(projectSettings,"取消").click();
  console.log("PASS 项目新建空输入、取消、非法日期、清空负责人并刷新恢复、取消删除保留项目");
  await btn(a, /^任务 ?0/).click();
  await btn(a, "查看可推进任务").click();
  const noPlan = a.getByRole("dialog", {name:"查看可推进任务"});
  await noPlan.getByRole("status").filter({hasText:"尚未发布正式计划"}).waitFor();
  assert.equal(await noPlan.getByRole("checkbox").count(), 0);
  await btn(noPlan, "关闭").click();
  await btn(a, "查看可推进任务").click();
  await btn(noPlan, "前往施工蓝图").click();
  await noPlan.waitFor({state:"hidden"});
  await btn(a, "编辑草案").waitFor();
  console.log("PASS 空项目任务页查看推进条件、无正式版本提示、关闭和前往施工蓝图");
  await btn(a, "编辑草案").click();
  await btn(a, "新增任务").click();
  await a.getByRole("textbox", { name: "任务标题" }).fill("复核回归清单");
  const canvas = a.locator(".project-canvas"),
    tile = a.locator(".project-node").first();
  await a.setViewportSize({ width: 880, height: 840 });
  const position = await tile.evaluate((el) => ({
    x: el.style.left,
    y: el.style.top,
  }));
  const bounds = await tile.boundingBox();
  assert.ok(bounds);
  await a.mouse.move(bounds.x + 30, bounds.y + 26);
  await a.mouse.down();
  await a.mouse.move(bounds.x + 82, bounds.y + 54, { steps: 8 });
  await a.mouse.up();
  await a.waitForFunction(
    ([x, y]) => {
      const node = document.querySelector(".project-node");
      return node && (node.style.left !== x || node.style.top !== y);
    },
    [position.x, position.y],
  );
  await canvas.focus();
  await a.keyboard.press("Control+z");
  await a.waitForFunction(
    ([x, y]) => {
      const node = document.querySelector(".project-node");
      return node?.style.left === x && node?.style.top === y;
    },
    [position.x, position.y],
  );
  await a.keyboard.press("Control+Shift+z");
  await a.setViewportSize({ width: 1440, height: 900 });
  await btn(a, "查看变更并发布").click();
  dialog = a.getByRole("dialog").last();
  await btn(dialog, "发布 V1").waitFor();
  await a.keyboard.press("Escape");
  await btn(a, "查看变更并发布").click();
  await btn(a.getByRole("dialog").last(), "发布 V1").click();
  await btn(a, "版本历史").click();
  await a.getByRole("dialog").last().getByText(/V1/).first().waitFor();
  await a.keyboard.press("Escape");
  await a.reload();
  await btn(a, "版本历史").waitFor();
  await verifyBlueprintRefresh(a);
  await verifyCanvasGestures(a);
  await btn(a, /^任务 ?1/).click();
  await btn(a, /复核回归清单/).click();
  await a.getByText("任务来源", { exact: true }).waitFor();
  await a.screenshot({ path: resolve(artifacts, "task.png") });
  console.log(
    "PASS A/B 注册、空团队、邀请、项目、草案、关闭预览、发布、历史、刷新和项目任务详情",
  );
  await b.getByRole("button", { name: "全部任务", exact: true }).click();
  await btn(b, "显示").click();
  await btn(b, "表格").click();await b.locator("table[aria-label=任务表格]").waitFor();await b.keyboard.press("Escape");
  const projectTaskRow=b.locator("tr[data-task-id]").filter({hasText:"复核回归清单"});
  const priorityCell=projectTaskRow.locator('[data-column="priority"] select');
  const nextPriority=(await priorityCell.inputValue())==="high"?"medium":"high";
  await priorityCell.selectOption(nextPriority);
  await projectTaskRow.locator('[data-column="priority"] span').filter({hasText:nextPriority==="high"?"高":"中"}).waitFor();
  await b.reload();
  await priorityCell.waitFor();
  assert.equal(await priorityCell.inputValue(),nextPriority);
  const currentId=await projectTaskRow.getAttribute("data-task-id");
  await a.reload();
  const projectPriority=a.locator(".team-task-properties").getByRole("combobox",{name:"优先级",exact:true});
  await projectPriority.filter({hasText:nextPriority==="high"?"高":"中"}).waitFor();
  assert.equal(new URL(a.url()).hash.split("/issue/")[1].split("?")[0],currentId);
  await btn(b, /复核回归清单/).click();
  await b.getByText("任务来源", { exact: true }).waitFor();
  assert.equal(
    new URL(a.url()).hash.split("/issue/")[1].split("?")[0],
    new URL(b.url()).hash.split("/issue/")[1].split("?")[0],
  );
  const originalTaskTitle=(await b.locator(".v3-issue-main h1").innerText()).trim();
  const rename=(page)=>page.getByRole("textbox",{name:"编辑任务标题"});
  await heading(b,originalTaskTitle).getByRole("button").click();
  await rename(b).fill("取消的任务标题");await rename(b).press("Escape");await heading(b,originalTaskTitle).waitFor();
  await heading(b,originalTaskTitle).getByRole("button").click();
  await rename(b).fill(originalTaskTitle+"已校对");await rename(b).press("Enter");
  await heading(b,originalTaskTitle+"已校对").waitFor();
  await a.reload();await heading(a,originalTaskTitle+"已校对").waitFor();
  await heading(b,originalTaskTitle+"已校对").getByRole("button").click();await rename(b).fill(originalTaskTitle);
  await rename(b).press("Enter");await heading(b,originalTaskTitle).waitFor();
  await btn(b,"编辑任务描述").click();
  const description=b.getByRole("textbox",{name:"编辑任务描述"});await description.fill("取消的描述");
  await btn(b,"取消").click();assert.equal(await description.count(),0);
  await b.setViewportSize({width:390,height:844});
  await btn(b, "发起会话").click();
  let side = b.getByRole("dialog", { name: "临时 Work 会话" });
  assert.equal(await btn(side, "发送").isDisabled(), true);
  await side.getByRole("textbox").fill("刷新会清空这条草稿");
  await b.reload();
  await btn(b, "发起会话").click();
  side = b.getByRole("dialog", { name: "临时 Work 会话" });
  assert.equal(await side.getByRole("textbox").inputValue(), "");
  const sideRect=await side.boundingBox();
  assert.ok(sideRect && sideRect.x>=0 && sideRect.x+sideRect.width<=391);
  assert.ok(await side.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await b.screenshot({path:resolve(artifacts,"task-side-390.png")});
  await btn(side, "关闭").click();
  await b.setViewportSize({width:1440,height:900});
  await btn(a, "新建").click();
  let composer = a.locator(".wb-composer textarea");
  await a.getByRole("heading",{name:"Mobile熠动，Work智简"}).waitFor();
  await a.screenshot({path:resolve(artifacts,"home.png")});
  await btn(a,"填入建议").click();
  assert.ok((await composer.inputValue()).length>0);
  await composer.fill("");
  await a.locator(".wb-home-tabs").getByRole("button",{name:"任务",exact:true}).click();
  const homeTask=a.getByRole("region",{name:"新建任务"});
  await btn(homeTask,"切换到智能体").click();
  await btn(homeTask,"切换到手动").click();
  await btn(homeTask,"会话").click();
  await a.locator(".wb-home-tabs").getByRole("button",{name:"任务",exact:true}).click();
  await homeTask.locator('input:not([type]),input[type="text"]').first().fill("首页直接创建 "+stamp);
  await btn(homeTask,"创建任务").click();
  await a.waitForURL(/issue\//);
  await btn(a,"新建").click();
  const homeUpload=a.getByLabel("添加会话附件");
  await homeUpload.setInputFiles({name:"清单.txt",mimeType:"text/plain",buffer:Buffer.from("桌面附件")});
  await btn(a,"移除 清单.txt").click();
  assert.equal(await btn(a,"移除 清单.txt").count(),0);
  await homeUpload.setInputFiles({name:"清单.txt",mimeType:"text/plain",buffer:Buffer.from("桌面附件")});
  await btn(a,"选择伙伴").click();
  await a.locator(".wb-partners button").filter({hasText:"uib"+stamp}).click();
  assert.match(await composer.inputValue(),/@uib/);

  await composer.fill("@uib" + stamp + " 请核对接口回执");
  await composer.press("Enter");
  await a.getByRole("textbox", { name: "会话消息" }).waitFor();
  await btn(b, "全部会话").click();
  await btn(b, new RegExp("uib" + stamp))
    .first()
    .click();
  await btn(b,"清单.txt").waitFor();
  const reply = b.getByRole("textbox", { name: "会话消息" });
  await reply.fill("已核对 " + stamp);
  await reply.press("Enter");
  await a.getByText("已核对 " + stamp, { exact: true }).waitFor();
  const draftInput=a.getByRole("textbox",{name:"会话消息"});
  await draftInput.fill("未发送的本页草稿"+stamp);await a.reload();await draftInput.waitFor();
  assert.equal(await draftInput.inputValue(),"未发送的本页草稿"+stamp);assert.equal(await reply.inputValue(),"");
  await draftInput.fill("");await btn(a,"成员").click();
  const mentionPanel=a.getByRole("dialog",{name:"选择提及对象"});
  await mentionPanel.getByRole("button",{name:new RegExp("uib"+stamp)}).click();
  assert.match(await draftInput.inputValue(),new RegExp("@uib"+stamp));await draftInput.fill("");
  await a.getByLabel("添加附件",{exact:true}).setInputFiles([
    {name:"同名回执.txt",mimeType:"text/plain",buffer:Buffer.from("甲")},
    {name:"同名回执.txt",mimeType:"text/plain",buffer:Buffer.from("乙")},
    {name:"移除.txt",mimeType:"text/plain",buffer:Buffer.alloc(0)}
  ]);
  await btn(a,"移除附件 移除.txt").click();await btn(a,"发送消息").click();
  await btn(b,"同名回执.txt").nth(1).waitFor();
  for(const [i,expected] of ["甲","乙"].entries()){
    const downloaded=b.waitForEvent("download");await btn(b,"同名回执.txt").nth(i).click();
    const path=resolve(artifacts,"room-file-"+i+".txt");await (await downloaded).saveAs(path);assert.equal(await readFile(path,"utf8"),expected);
  }
  const lostText="已保存但回执中断 "+stamp;
  const matchRoomPost=url=>(url.searchParams.get("path")||"").endsWith("/messages") && (url.searchParams.get("path")||"").includes("/workbench/rooms/");
  await a.route(matchRoomPost,async route=>{
    const upstream=await route.fetch();assert.ok(upstream.ok());
    await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"测试回执中断"})});
  },{times:1});
  await draftInput.fill(lostText);await draftInput.press("Enter");
  await b.locator(".room-history").getByText(lostText,{exact:true}).waitFor();
  await a.reload();await draftInput.waitFor();assert.equal(await draftInput.inputValue(),lostText);
  await draftInput.press("Enter");await a.waitForFunction(()=>document.querySelector('[aria-label="会话消息"]').value==="");
  await b.reload();await b.locator(".room-history").getByText(lostText,{exact:true}).waitFor();
  assert.equal(await b.locator(".room-history").getByText(lostText,{exact:true}).count(),1);
  await btn(a,"查看参与成员").click();await a.getByRole("dialog",{name:"参与成员",exact:true}).locator(".room-member-list > div").filter({hasText:"uib"+stamp}).getByText("协作成员",{exact:true}).waitFor();await a.keyboard.press("Escape");
  assert.equal(await a.locator(".room-composer").getByRole("combobox",{name:/模型|执行模式/}).count(),0);
  assert.equal(await a.locator(".room-composer").getByRole("button",{name:/切换模型|执行模式/}).count(),0);
  const sourceRoomUrl=b.url();
  await btn(b,"会话设置").click();
  const readonlySettings=b.getByRole("dialog",{name:"会话设置",exact:true});
  assert.equal(await readonlySettings.getByRole("textbox",{name:"会话名称"}).isDisabled(),true);
  await btn(readonlySettings,"将讨论整理为任务").click();
  const explicitSummary=b.getByRole("dialog",{name:"转为任务",exact:true});
  await explicitSummary.getByRole("textbox",{name:"任务标题"}).fill("会议整理"+stamp);
  await explicitSummary.getByRole("textbox",{name:"任务描述"}).fill("仅公开验收项");
  await btn(explicitSummary,"创建任务").click();await heading(b,"会议整理"+stamp).waitFor();
  await b.goto(sourceRoomUrl);await b.locator(".room-linked").getByRole("button",{name:"会议整理"+stamp}).waitFor();
  console.log("PASS 会话草稿按身份刷新恢复、参与者和提及选择、多附件原字节、回执丢失后重试、只读成员从设置建任务");
  await btn(a,"会话设置").click();await btn(a,"复制会话链接").click();await a.locator(".room-management").getByText("已复制",{exact:true}).waitFor();
  await a.keyboard.press("Escape");
  await btn(a,"搜索会话消息").click();
  let searchRoom=a.getByRole("dialog",{name:"会话内搜索"});
  let lookup=searchRoom.getByRole("searchbox",{name:"搜索当前会话"});
  await lookup.fill("无匹配项"+stamp);await searchRoom.getByText("没有找到匹配结果",{exact:true}).waitFor();
  await lookup.fill("已核对 "+stamp);await searchRoom.locator(".room-results button").first().waitFor();
  await lookup.press("ArrowDown");await lookup.press("Enter");
  assert.ok(await a.locator(".room-message:focus").count());
  await btn(a,"搜索会话消息").click();
  await searchRoom.getByRole("searchbox").fill("总结本次会话");
  await btn(searchRoom,"智能").click();
  await searchRoom.getByText(/【Mock】已读取可见上下文/).waitFor();
  await a.keyboard.press("Escape");
  assert.equal(await a.locator(".room-history").getByText(/本次问题：总结本次会话/).count(),0);
  console.log("PASS 会话链接复制、快搜无匹配、键盘定位消息、智能搜索仅在临时侧栏回复");

  await btn(a, "会话设置").click();
  let settings = a.getByRole("dialog",{name:"会话设置",exact:true});
  await btn(settings,"将讨论整理为任务").click();
  const summaryDialog=a.getByRole("dialog",{name:"转为任务",exact:true});
  await summaryDialog.getByRole("textbox",{name:"任务标题"}).fill("放弃整理"+stamp);
  await btn(summaryDialog,"取消").click();await settings.waitFor();
  await settings.evaluate(async el=>{
    await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
    await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})));
  });
  const roomName=settings.getByRole("textbox",{name:"会话名称"});
  const previousRoomTitle=await roomName.inputValue();
  await roomName.fill("");await settings.getByRole("alert").filter({hasText:"请输入会话名称"}).waitFor();
  await roomName.dispatchEvent("compositionstart");
  await roomName.fill("协作输入法尚未上屏");
  // The debounce interval expires while a Chinese IME composition is still active.
  await new Promise(resolve=>setTimeout(resolve,650));
  await b.reload();await heading(b,previousRoomTitle).waitFor();
  await roomName.fill("验收私聊" + stamp);await roomName.dispatchEvent("compositionend");
  await settings
    .getByRole("textbox", { name: "新项目名称" })
    .fill("讨论归属" + stamp);
  assert.equal(await settings.getByRole("textbox",{name:"会话名称"}).inputValue(),"验收私聊"+stamp);
  assert.equal(await settings.getByRole("textbox",{name:"新项目名称"}).inputValue(),"讨论归属"+stamp);
  await b.reload();await heading(b,"验收私聊"+stamp).waitFor();
  await btn(settings, "创建并关联").click();
  const savedRoomProject=settings.getByRole("combobox",{name:"所属项目"});
  const selectedProject=()=>savedRoomProject.locator("option:checked").innerText();
  await a.waitForFunction(title=>document.querySelector("select.room-project-select option:checked")?.textContent===title,"讨论归属"+stamp);
  await btn(settings,"关闭").click();
  await a.reload();await heading(a,"验收私聊"+stamp).waitFor();
  await btn(a,"会话设置").click();
  assert.equal(await selectedProject(),"讨论归属"+stamp);
  for(const label of ["无关联项目","讨论归属"+stamp]) {
    await savedRoomProject.selectOption({label});
    // Wait for the real backend mutation and query refresh before closing.
    await a.waitForFunction(title=>{
      const select=document.querySelector("select.room-project-select");
      return select && !select.disabled && select.selectedOptions[0]?.textContent===title;
    },label);
    await btn(settings,"关闭").click();await a.reload();
    await btn(a,"会话设置").click();assert.equal(await selectedProject(),label);
  }
  await btn(settings,"关闭").click();
  console.log("PASS 会话改名自动保存且另一身份可见，创建并关联项目、切换与清空归属分别读取实际回执");
  await btn(a, "转为任务").click();
  const typed = a.getByRole("textbox", { name: "会话消息" });
  assert.match(await typed.inputValue(), /@Work/);
  await typed.fill(
    "@Work 请分析当前会话记录，创建任务并关联到本会话。\n\n核对实际来源" +
      stamp,
  );
  await typed.press("Enter");
  await btn(a, "查看任务").last().click();
  await a.getByText("任务来源", { exact: true }).waitFor();
  await a
    .getByText("验收私聊" + stamp, { exact: true })
    .last()
    .waitFor();
  const openFor = async (page, source) => {
    const u = new URL(page.url());
    u.hash = new URL(source.url()).hash;
    await page.goto(u.href);
  };
  await openFor(c, a);
  await c.getByText("没有来源会话").waitFor();
  assert.ok(
    !(await c.locator("body").innerText()).includes("验收私聊" + stamp),
  );
  await c.screenshot({ path: resolve(artifacts, "private-source-c.png") });
  await btn(a, "全部会话").click();
  await btn(a, "新建会话").click();
  dialog = a.getByRole("dialog").last();
  await dialog.getByLabel("会话名称").fill("弱网交付" + stamp);
  for (const role of ["b", "c"])
    await dialog
      .getByRole("checkbox", { name: new RegExp("ui" + role + stamp) })
      .check();
  await btn(dialog, "创建会话").click();
  await heading(a, "弱网交付" + stamp).waitFor();
  await btn(a.locator(".room-main form"),"智能体").click();
  await btn(a.getByRole("dialog",{name:"选择提及对象"}),"Work").click();
  const groupInput=a.getByRole("textbox",{name:"会话消息"});assert.equal(await groupInput.inputValue(),"@Work ");
  await groupInput.fill("@Work 核对本次讨论");await groupInput.press("Enter");
  await a.locator(".room-history").getByRole("region",{name:"Work 回复"}).getByText(/【Mock】/).first().waitFor();

  await openFor(b, a);
  await openFor(c, a);
  const sendTo = async (page, text) => {
    const input = page.getByRole("textbox", { name: "会话消息" });
    await input.fill(text);
    await input.press("Enter");
  };
  await sendTo(b, "重试时保留草稿 " + stamp);
  await sendTo(c, "检查上传回执 " + stamp);
  await a.getByText("重试时保留草稿 " + stamp, { exact: true }).waitFor();
  await a.getByText("检查上传回执 " + stamp, { exact: true }).waitFor();
  await sendTo(a, "@Work 总结群聊消息");
  await c.getByText("@Work 总结群聊消息", { exact: true }).waitFor();
  await sendTo(
    a,
    "@Work 请分析当前会话记录，创建任务并关联到本会话。\n\n验证弱网重试 " +
      stamp,
  );
  await btn(c, "查看任务").last().click();
  await heading(c, "验证弱网重试 " + stamp).waitFor();
  await btn(c, "弱网交付" + stamp)
    .last()
    .waitFor();
  await c.screenshot({ path: resolve(artifacts, "group-source-c.png") });
  console.log(
    "PASS 同一空团队三身份私聊隐藏、群中两人发言、第三身份从共享任务回溯群聊",
  );
  // A stages the removal, cancels once, then commits. C retains the task throughout.
  const groupTaskUrl = c.url();
  const groupSettings = a.getByRole("dialog", {name: "会话设置"});
  const openGroupSettings = () => btn(a, "会话设置").click();
  const removeThird = () => btn(groupSettings, "移除 uic" + stamp).click();
  const removeParticipant=a.getByRole("dialog",{name:"移除会话成员",exact:true});
  await openGroupSettings();
  await removeThird();await btn(removeParticipant,"取消").click();
  await btn(groupSettings, "关闭").click();
  await openGroupSettings();
  await removeThird();await btn(removeParticipant,"确认移除").click();
  await removeParticipant.waitFor({state:"hidden"});
  await btn(groupSettings,"关闭").click();
  await c.bringToFront();
  await c.locator(".v3-issue-source").getByText("没有来源会话").waitFor();
  assert.equal(c.url(),groupTaskUrl);
  assert.equal(await c.locator(".v3-issue-source button").count(),0);
  await openFor(c,a);
  await c.reload();
  await btn(c, "返回会话").waitFor();
  await c.getByRole("alert").waitFor();
  assert.equal(await heading(c, "弱网交付" + stamp).count(), 0);
  assert.ok(!(await c.locator("body").innerText()).includes("检查上传回执 " + stamp));
  await c.goto(groupTaskUrl);
  await heading(c, "验证弱网重试 " + stamp).waitFor();
  await c.getByText("没有来源会话").waitFor();
  await openGroupSettings();
  await groupSettings.getByRole("combobox", {name:"邀请空间成员"}).click();
  await a.getByRole("option", {name:new RegExp("uic" + stamp)}).click();
  await btn(groupSettings, "邀请").click();
  await btn(groupSettings,"移除 uic"+stamp).waitFor();
  await btn(groupSettings,"关闭").click();
  await c.reload();
  await btn(c, "弱网交付" + stamp).last().click();
  await c.getByText("检查上传回执 " + stamp, {exact:true}).waitFor();
  console.log("PASS 会话设置取消移除、确认后撤权、任务保留且隐藏来源、重新邀请恢复原消息");
  await btn(a, "搜索会话与任务").click();
  dialog = a.getByRole("dialog").last();
  await dialog.getByRole("textbox").fill("查无此项" + stamp);
  await dialog.getByText("没有搜索结果").waitFor();
  await dialog.getByRole("textbox").fill("复核回归清单");
  await btn(dialog, "复核回归清单").click();
  await a.getByText("任务来源", { exact: true }).waitFor();
  async function settingsPage(page=a) {
    await btn(page,"账户菜单").click();
    await btn(page,"设置").click();
    const panel=page.getByRole("dialog",{name:"设置",exact:true});
    await heading(panel,"账户管理").waitFor();
    return panel;
  }
  const sub = name => a.getByRole("dialog",{name,exact:true});
  const closeSettings = async (page=a) => {
    const modal=page.getByRole("dialog",{name:"设置",exact:true});
    await modal.getByRole("button",{name:/^(Close|关闭)$/i}).last().click();
    await modal.waitFor({state:"hidden"});
  };
  const captureTab = async (panel,key) => {await panel.screenshot({path:resolve(artifacts,"preferences-"+key+".png"),animations:"disabled"});};
  dialog=await settingsPage();
  await captureTab(dialog,"account");
  await btn(dialog,"退出登录").click();await btn(sub("退出登录"),"取消").click();
  await btn(dialog,"我的积分").click();await btn(sub("我的积分"),"关闭").click();
  await btn(dialog,"个性化").click();
  const instruction=dialog.getByRole("textbox",{name:"自定义指令"});
  await instruction.fill("暂时不保存");await closeSettings();
  dialog=await settingsPage();await btn(dialog,"个性化").click();assert.equal(await instruction.inputValue(),"");
  await captureTab(dialog,"personalization");
  await instruction.fill("先陈述验收条件"+stamp);
  const instructionSaved=a.waitForResponse(r=>new URL(r.url()).searchParams.get("path")==="/api/workbench/preferences" && r.request().method()==="POST");
  await btn(dialog,"保存指令").click();assert.equal((await instructionSaved).ok(),true);
  await a.waitForFunction(()=>Array.from(document.querySelectorAll("button")).some(b=>b.textContent==="保存指令"&&b.disabled));
  await closeSettings();await a.reload(); dialog=await settingsPage();await btn(dialog,"个性化").click();
  assert.equal(await instruction.inputValue(),"先陈述验收条件"+stamp);
  await btn(dialog,"系统设置").click();await dialog.getByRole("slider",{name:"聊天字号"}).waitFor();
  // The change is complete after the device service persists it and the client re-reads the current version.
  async function mutateSetting(trigger) {
    const read = a.waitForResponse(r => r.url().endsWith("/api/workbench/operation") && r.request().postDataJSON()?.operation==="device.save");
    await trigger();assert.equal((await read).ok(),true);
    await a.waitForFunction(()=>!document.querySelector(".mw-preferences-body :is(input,select,button):disabled"));
  }
  await mutateSetting(()=>btn(dialog,"默认14").click());
  await mutateSetting(()=>btn(dialog,"浅色").click());
  await a.waitForFunction(()=>document.documentElement.dataset.mwTheme==="light");
  await captureThemeColors(a,artifacts,"light");
  await mutateSetting(()=>dialog.getByLabel("关闭偏好").selectOption("保留窗口"));
  await captureTab(dialog,"system");
  await btn(dialog,"了解").click();await sub("本地存储").getByText(/PostgreSQL/).waitFor();await btn(sub("本地存储"),"关闭").click();
  await mutateSetting(()=>btn(dialog,"深色").click());
  await mutateSetting(()=>dialog.getByLabel("语言偏好").selectOption("English"));
  await mutateSetting(()=>dialog.getByLabel("关闭偏好").selectOption("保留窗口"));
  await mutateSetting(()=>btn(dialog,"大18").click());
  await closeSettings();await a.waitForFunction(()=>document.documentElement.style.getPropertyValue("--work-chat-size")==="18px");
  await a.reload();await a.waitForFunction(()=>document.documentElement.dataset.mwTheme==="dark");
  await captureThemeColors(a,artifacts,"dark");
  const colors=["--mw-home-page","--mw-home-pane","--mw-dialog-surface","--mw-gray-9","--mw-brand-bg"];
  const colorsAt=()=>a.locator(".team-root").evaluate((el,props)=>props.map(k=>getComputedStyle(el).getPropertyValue(k).trim()),colors);
  assert.deepEqual(await colorsAt(),["#2f3034","#191b1f","#2f3034","#1d242e","#1890ff29"]);
  dialog=await settingsPage();await btn(dialog,"系统设置").click();
  assert.equal(await dialog.getByLabel("语言偏好").inputValue(),"English");
  assert.equal(await dialog.getByLabel("关闭偏好").inputValue(),"保留窗口");
  await mutateSetting(()=>dialog.getByLabel("语言偏好").selectOption("简体中文"));
  await mutateSetting(()=>dialog.getByLabel("关闭偏好").selectOption("退出"));
  await mutateSetting(()=>btn(dialog,"默认14").click());
  await mutateSetting(()=>btn(dialog,"跟随系统").click());
  await a.emulateMedia({colorScheme:"light"});await a.waitForFunction(()=>document.documentElement.dataset.mwTheme==="light");
  for(const [tab,labels] of [["安全与审计",["安全防护","沙箱保护"]],["守护进程",["自动启动守护进程","自动停止守护进程"]],["软件配置",["开机启动"]]]) {
    await btn(dialog,tab).click();
    const values=[];
    for(const label of labels) {
      const flag=dialog.getByRole("checkbox",{name:label});values.push(await flag.isChecked());
      await mutateSetting(()=>flag.click());
    }
    await closeSettings();dialog=await settingsPage();await btn(dialog,tab).click();
    for(const [i,label] of labels.entries()) {
      const flag=dialog.getByRole("checkbox",{name:label});
      assert.equal(await flag.isChecked(),!values[i]);await mutateSetting(()=>flag.click());
    }
  }
  await btn(dialog,"复制版本信息").click();await dialog.getByText("已复制",{exact:true}).waitFor();
  await btn(dialog,"查看").click();await sub("快捷键").getByText(/Shift/).waitFor();await btn(sub("快捷键"),"关闭").click();
  await btn(dialog,"安全与审计").click();await dialog.getByRole("button",{name:"查看明细",exact:true}).first().click();await btn(sub("行为审计"),"关闭").click();
  await btn(dialog,"模型").click();
  await btn(dialog,"添加模型").waitFor();
  const priorModels=await dialog.getByRole("button",{name:/^移除 /}).allTextContents();
  await btn(dialog,"添加模型").click();
  const addModel=sub("添加模型"), model="test-"+stamp;
  await btn(addModel,"添加").click();await addModel.getByRole("alert").waitFor();
  await addModel.getByLabel("样例名称").fill(model);await btn(addModel,"添加").click();await addModel.waitFor({state:"hidden"});
  await closeSettings();dialog=await settingsPage();await btn(dialog,"模型").click();
  await btn(dialog,"添加模型").click();await addModel.getByLabel("样例名称").fill(model.toUpperCase());await btn(addModel,"添加").click();
  await addModel.getByText("模型样例名称重复").waitFor();await btn(addModel,"取消").click();
  await btn(dialog,"移除 "+model).click();await btn(sub("移除模型"),"取消").click();
  await btn(dialog,"移除 "+model).click();await btn(sub("移除模型"),"确认移除").click();await sub("移除模型").waitFor({state:"hidden"});
  await btn(dialog,"移除 "+model).waitFor({state:"hidden"});
  assert.deepEqual(await dialog.getByRole("button",{name:/^移除 /}).allTextContents(),priorModels);
  if (!priorModels.length) await dialog.getByText("暂无模型样例").waitFor();
  await btn(dialog,"记忆").click();await btn(dialog,"编辑").click();await sub("管理对话记忆").getByLabel("手动记忆").fill("本人的测试记忆"+stamp);
  await btn(sub("管理对话记忆"),"保存").click();await dialog.getByText("本人的测试记忆"+stamp,{exact:true}).waitFor();
  const other=await settingsPage(b);await btn(other,"记忆").click();await other.getByText("暂无手动记录。").waitFor();await closeSettings(b);
  await btn(dialog,"帮助与反馈").click();await captureTab(dialog,"help");await btn(dialog,"打开").click();
  await a.getByRole("dialog",{name:/使用与实现手册/}).getByRole("heading",{name:/使用与实现手册/}).first().waitFor();
  await a.keyboard.press("Escape");await a.getByRole("dialog",{name:/使用与实现手册/}).waitFor({state:"hidden"});
  await dialog.getByRole("button",{name:"查看",exact:true}).first().click();await btn(sub("问题反馈"),"关闭").click();
  await dialog.getByRole("button",{name:"查看",exact:true}).last().click();await btn(sub("关于 MobileWork"),"关闭").click();await closeSettings();
  console.log("PASS 账户、系统、记忆、模型、个性化、软件、守护进程、安全与帮助九个设置入口，取消、个人隔离、重复名称及设备保存回读");
  console.log(
    "PASS 两个桌面身份收发私聊、刷新清除临时草稿、搜索空态及直达、个人设置刷新恢复",
  );
  await a.getByRole("combobox", { name: "工作区" }).click();
  const teamPicker=a.getByRole("dialog",{name:"切换团队"});
  await teamPicker.getByLabel("搜索团队").fill("无匹配-"+stamp);
  await teamPicker.getByText("没有找到团队").waitFor();
  await a.keyboard.press("Escape");
  assert.equal(await teamPicker.count(),0);
  await a.getByRole("combobox",{name:"工作区"}).click();
  await btn(a,"团队设置").click();
  await a.getByRole("dialog",{name:"团队设置"}).getByRole("heading",{name:"基础信息"}).waitFor();
  await a.keyboard.press("Escape");
  await a.getByRole("combobox",{name:"工作区"}).click();
  await btn(a, "新建演示工作区").click();
  await heading(a, "移动端弱网上传").waitFor();
  await a.screenshot({ path: resolve(artifacts, "demo-catalog.png") });
  await btn(a,"新建项目").first().click();await a.getByLabel("项目名称",{exact:true}).waitFor();
  await checkPanel(a,".mw-project-form-dialog",{x:480,width:480,header:66,blur:"blur(2px)",scrim:"rgba(24, 39, 62, 0.22)"});
  await a.screenshot({path:resolve(artifacts,"demo-project-create.png"),animations:"disabled"});
  await a.keyboard.press("Escape");
  await btn(a,"新建").click();
  await a.locator(".wb-home-title").waitFor();
  const recent=a.getByRole("region",{name:"最近会话"});
  await recent.getByRole("button",{name:"弱网上传交付协作，2 条未读",exact:true}).waitFor();
  assert.equal(await recent.locator(".mw-nav-row").count(),2);
  const relatedFolder=btn(a,"收起项目 移动端弱网上传");
  assert.match(await relatedFolder.innerText(),/3 未读/);
  await relatedFolder.click();await btn(a,"展开项目 移动端弱网上传").click();
  const sidebarGeometry=await a.locator(".wb-sidebar").evaluate(el=>Object.fromEntries(
    [".wb-new",".mw-space-links",".mw-sidebar-regions>section:nth-child(1)",".mw-sidebar-regions>section:nth-child(2)",".mw-sidebar-regions>section:nth-child(3)"].map(selector=>{
      const box=el.querySelector(selector).getBoundingClientRect();
      return [selector,[box.x,box.y,box.width,box.height].map(Math.round)];
    })));
  for(const [selector,expected] of [
    [".wb-new",[12,92,234,39]],[".mw-space-links",[0,139,258,123]],
    [".mw-sidebar-regions>section:nth-child(1)",[12,265,234,102]],
    [".mw-sidebar-regions>section:nth-child(2)",[12,395,234,102]],
  ]) assert.deepEqual(sidebarGeometry[selector],expected,selector);
  console.log("PASS 侧栏三个平级入口、近期排序与未读、按项目折叠、切换团队空态与取消，以及四处设计几何");
  await a.mouse.move(750,42);
  await a.screenshot({path:resolve(artifacts,"demo-home.png")});
  await a.getByRole("button",{name:/^通知，/}).click();await a.getByRole("dialog",{name:"通知中心"}).waitFor();
  await checkPanel(a,".mw-notice-panel",{x:996,y:40,width:430,height:690});
  await a.screenshot({path:resolve(artifacts,"demo-notifications.png"),animations:"disabled"});
  await a.keyboard.press("Escape");
  await a.getByRole("combobox",{name:"工作区"}).click();
  await a.getByRole("dialog",{name:"切换团队"}).waitFor();
  await checkPanel(a,".v3-workspaces",{x:12,y:84,width:330});
  await a.screenshot({path:resolve(artifacts,"demo-switch.png"),animations:"disabled"});
  await a.keyboard.press("Escape");
  await recent.getByRole("button",{name:/弱网上传交付协作/}).first().click();
  await a.locator(".room-linked").getByRole("button",{name:"确定弱网复现条件"}).waitFor();
  await a.locator(".room-history .room-file").first().waitFor();
  await checkPanel(a,".room-main .room-header",{x:258,y:32,width:1182,height:56});
  await checkPanel(a,".room-linked",{x:258,y:88,width:1182,height:44});
  await checkPanel(a,".room-main .room-composer",{x:418,y:680,width:862,height:180});
  await a.screenshot({path:resolve(artifacts,"demo-room.png"),animations:"disabled"});
  await btn(a,"搜索会话消息").click();await checkPanel(a,".room-search",{x:1060,y:32,width:380,height:868});
  await a.screenshot({path:resolve(artifacts,"demo-room-search.png"),animations:"disabled"});
  await a.keyboard.press("Escape");await btn(a,"会话设置").click();
  await a.getByRole("dialog",{name:"会话设置"}).waitFor();
  const seededSettings=a.getByRole("dialog",{name:"会话设置"});
  const participating=seededSettings.locator(".room-member-list");
  await participating.getByRole("button",{name:"移除 交付整理助手",exact:true}).waitFor();
  await participating.getByText(/的 Work 助手/).waitFor();
  await captureRoomSettings(a,artifacts);
  await a.screenshot({path:resolve(artifacts,"demo-room-settings.png"),animations:"disabled"});
  const seedRoomUrl=a.url();
  const kick=()=>btn(seededSettings,"移除 交付整理助手").click();
  await kick();await btn(removeParticipant,"取消").click();await btn(seededSettings,"关闭").click();
  await btn(a,"会话设置").click();await kick();
  await btn(removeParticipant,"确认移除").click();await removeParticipant.waitFor({state:"hidden"});await btn(seededSettings,"关闭").click();
  await a.reload();await btn(a,"会话设置").click();
  await participating.getByText(/的 Work 助手/).waitFor();
  assert.equal(await participating.getByRole("button",{name:"移除 交付整理助手",exact:true}).count(),0);
  await seededSettings.getByRole("combobox",{name:"邀请空间成员"}).click();
  await a.getByRole("option",{name:"交付整理助手",exact:true}).click();
  await btn(seededSettings,"邀请").click();await btn(seededSettings,"移除 交付整理助手").waitFor();
  await btn(seededSettings,"关闭").click();
  await a.reload();await btn(a,"会话设置").click();
  await participating.getByRole("button",{name:"移除 交付整理助手",exact:true}).waitFor();
  assert.equal(a.url(),seedRoomUrl);
  console.log("PASS 样例群的真人和智能体名单，取消移除、确认移除、重新邀请，刷新核对同一会话");

  await a.keyboard.press("Escape");await btn(a,"新建").click();
  await a.getByLabel("添加会话附件").setInputFiles({name:"冻结清单.txt",mimeType:"text/plain",buffer:Buffer.from("版本一")});
  await a.locator(".wb-send").click();
  await a.locator(".wb-question button").filter({hasText:"冻结清单.txt"}).click();
  const ownFile=a.getByRole("dialog",{name:"冻结清单.txt"});
  await ownFile.getByText(/9 字节/).waitFor();
  await btn(ownFile,"查看来源").click();
  await a.locator(".wb-messages .team-located").getByText("冻结清单.txt",{exact:true}).waitFor();
  await a.reload();
  await a.locator(".wb-question button").filter({hasText:"冻结清单.txt"}).waitFor();
  console.log("PASS 首页建议、内联任务模式切换和创建、取消附件、仅附件提交、文件详情与刷新回到来源");

  for (const [label, key] of [
    ["协作空间", "space"],
    ["智能体", "agents"],
    ["智能体小队", "squads"],
  ]) {
    await btn(a, label).click();
    await heading(a, label).waitFor();
    if (key === "space") await a.locator(".space-identity").waitFor();
    else await a.locator(".directory-count").waitFor();
    if(key==="agents" || key==="squads") {
      if(key==="agents") await a.locator(".directory-card").filter({has:heading(a,"Work")}).getByText("在线",{exact:true}).waitFor();
      await captureDirectoryGeometry(a,key,artifacts);
    }
    await a.screenshot({ path: resolve(artifacts, "demo-" + key + ".png") });
    if (key === "space") {
      await btn(a,"编辑空间资料").click();
      const panel=a.getByRole("dialog",{name:"团队设置"});
      await panel.getByRole("heading",{name:"基础信息"}).waitFor();
      await checkPanel(a,".tm-settings-dialog",{x:180,y:70,width:1080,height:760,header:67,blur:"blur(5px)"});
  await measureManagement(a,"team-settings");await a.screenshot({path:resolve(artifacts,"demo-team-settings.png"),animations:"disabled"});
      await panel.getByRole("button",{name:/成员管理/}).click();
      await panel.locator(".tm-member-row").first().waitFor();
      await measureManagement(a,"members");await a.screenshot({path:resolve(artifacts,"demo-members.png"),animations:"disabled"});
      await btn(panel,"邀请成员").click();await a.getByRole("dialog",{name:"邀请成员"}).waitFor();
      await checkPanel(a,".tm-invite-dialog",{x:470,width:500,header:69});
  await a.screenshot({path:resolve(artifacts,"demo-invite.png"),animations:"disabled"});
      await btn(a.getByRole("dialog",{name:"邀请成员"}),"取消").click();
      await panel.getByRole("button",{name:/^Close$|^关闭$/}).click();await panel.waitFor({state:"hidden"});
    }
  }
  await btn(a, "全部项目").click();
  await heading(a, "移动端弱网上传").click();
  await a.locator(".pd-project-body").waitFor();
  await a.screenshot({path:resolve(artifacts,"demo-overview.png")});
  await btn(a,"项目设置").click();
  await a.getByRole("dialog",{name:"项目设置"}).getByRole("combobox",{name:"项目负责人"}).waitFor();
  await checkPanel(a,".mw-project-form-dialog",{x:480,width:480,header:66});
  await a.screenshot({path:resolve(artifacts,"demo-project-settings.png"),animations:"disabled"});
  await a.keyboard.press("Escape");
  await btn(a, "施工蓝图").click();
  await a.locator(".project-node").first().waitFor();
  for(const [selector,expected] of [
    [".pd-project-header",[258,32,1182,247]],[".pd-project-tabs",[307,228,1084,51]],
    [".project-canvas",[308,511,792,585]],[".project-node",[388,651,250,130]],
  ]){
    const rect=await a.locator(selector).first().boundingBox();
    assert.ok(rect,selector);
    assert.deepEqual([rect.x,rect.y,rect.width,rect.height].map(Math.round),expected,"施工蓝图参考边界 "+selector);
  }
  await captureProjectControls(a, "blueprint", artifacts);
  await a.screenshot({ path: resolve(artifacts, "demo-blueprint.png") });
  await btn(a, "版本历史").click();
  const versionDialog = a.getByRole("dialog", {name:"版本历史"});
  await versionDialog.locator(".project-version").first().waitFor();
  await checkPanel(a,".mw-blueprint-dialog",{x:340,y:24,width:760,height:852,header:58,blur:"blur(2px)",scrim:"rgba(24, 39, 62, 0.22)"});
  await a.screenshot({path:resolve(artifacts,"demo-blueprint-history.png"),animations:"disabled"});
  await captureVersionHistory(a,artifacts);
  await a.keyboard.press("Escape");
  await a.setViewportSize({ width: 880, height: 840 });
  await btn(a,"适应画布").click();
  const area = a.locator(".project-canvas");
  await area.scrollIntoViewIfNeeded();
  const canvasRect = await area.boundingBox();
  await a.keyboard.down("Shift");
  await a.mouse.move(canvasRect.x + 3, canvasRect.y + 3);
  await a.mouse.down();
  await a.mouse.move(
    canvasRect.x + canvasRect.width - 3,
    canvasRect.y + canvasRect.height - 3,
    { steps: 10 },
  );
  await a.mouse.up();
  await a.keyboard.up("Shift");
  await a.waitForFunction(
    () => document.querySelectorAll(".project-node.selected").length > 1,
  );
  await a.setViewportSize({ width: 1440, height: 900 });

  await btn(a, /^任务 ?\d/).click();
  await a.locator(".project-task-list").first().waitFor();
  await captureProjectControls(a, "project-tasks", artifacts);
  await a.screenshot({path:resolve(artifacts,"demo-project-tasks.png")});
  const internalTasks = a.locator(".project-internal");
  assert.match(await internalTasks.locator("summary").innerText(), /智能体内部任务 · 1/);
  await internalTasks.locator("summary").click();
  assert.equal(await internalTasks.getByRole("button").count(), 1);
  const internalTitle = await internalTasks.locator("button strong").innerText();
  assert.ok(internalTitle.trim());
  await internalTasks.locator("summary").click();
  assert.equal(await internalTasks.getByRole("button").count(), 0);

  await btn(a, "查看可推进任务").click();
  await a.getByRole("dialog").last().getByRole("checkbox").first().waitFor();
  await checkPanel(a,".mw-handoff-dialog",{x:340,width:760,header:66,blur:"blur(2px)"});
  await captureHandoff(a,artifacts);
  await a.screenshot({path:resolve(artifacts,"demo-handoff.png"),animations:"disabled"});
  dialog = a.getByRole("dialog").last();
  const ready = dialog.getByRole("checkbox", { name: /^实现上传重试去重/ });
  await ready.check();
  await btn(dialog, /确认通知或请求执行/).click();
  await dialog
    .getByText(/已通知/)
    .first()
    .waitFor();
  await a.screenshot({ path: resolve(artifacts, "demo-receipt.png") });
  console.log("PASS 全局和项目同一任务 ID、样例项目、画布和真实交接");
  await a.keyboard.press("Escape");
  await a.locator(".project-task-list").getByRole("button",{name:/实现上传重试去重/}).first().click();
  await heading(a,"实现上传重试去重").waitFor();await a.getByText("任务来源",{exact:true}).waitFor();
  for(const [selector,expected] of [[".v3-issue-toolbar",[258,32,1182,56]],[".v3-issue-columns",[258,88,1182,812]],[".v3-issue-inspector",[1144,88,296,812]]]){
    const box=await a.locator(selector).boundingBox();assert.deepEqual([box.x,box.y,box.width,box.height].map(Math.round),expected,selector);
  }
  await a.getByText("前置交付已完成",{exact:true}).waitFor();
  await captureTaskDetail(a,artifacts);
  await a.screenshot({path:resolve(artifacts,"demo-task-detail.png"),animations:"disabled"});
  await verifyTaskInspector(a,artifacts);
  console.log("PASS 任务日期校验、选择及清除后重载，执行日志材料入口，临时侧聊双轮、调整宽度、关闭清空和原地址保持");
  const executionLog = a.locator(".v3-issue-inspector details").filter({has:a.locator("summary",{hasText:"执行日志"})}).first();
  await executionLog.locator("summary").first().click();
  assert.equal(await btn(executionLog,"运行智能体").isDisabled(),true);
  await executionLog.locator("summary").first().click();
  const detailMenu = btn(a,"任务操作");
  const itemAction = name => a.getByRole("menuitem",{name,exact:true});
  await detailMenu.click();
  await itemAction("置顶任务").click();
  await detailMenu.click();
  await itemAction("取消置顶").click();
  await detailMenu.click();
  await itemAction("编辑任务").click();
  await a.getByRole("dialog",{name:"编辑任务"}).waitFor();
  await a.keyboard.press("Escape");
  await detailMenu.click();
  await itemAction("删除任务").click();
  await btn(a.getByRole("dialog",{name:"删除任务"}),"取消").click();
  await heading(a,"实现上传重试去重").waitFor();
  await detailMenu.click();
  await itemAction("添加唤醒").click();
  await btn(a.getByRole("dialog",{name:"安排提醒"}),"取消").click();
  const subscribed = btn(a,"订阅");
  const unsubscribe = btn(a,"取消订阅");
  const alreadySubscribed = await unsubscribe.isVisible();
  await (alreadySubscribed ? unsubscribe : subscribed).click();
  await (alreadySubscribed ? subscribed : unsubscribe).waitFor();
  await a.reload();
  await (alreadySubscribed ? subscribed : unsubscribe).click();
  await (alreadySubscribed ? unsubscribe : subscribed).waitFor();
  await btn(a,"任务订阅者").click();
  assert.ok(await a.getByRole("group",{name:"任务订阅者"}).getByRole("checkbox").count());
  await btn(a.getByRole("group",{name:"任务订阅者"}),"关闭").click();
  await btn(a,"添加关联链接").click();
  const linkForm=a.getByRole("dialog",{name:"关联链接"});
  await linkForm.getByLabel("链接名称").fill("复验文档");
  await linkForm.getByLabel("链接地址").fill("relative");
  await btn(linkForm,"保存").click();
  await linkForm.getByRole("alert").locator(":scope > span").filter({hasText:"请输入有效的 HTTP 或 HTTPS 链接"}).waitFor();
  await linkForm.getByLabel("链接地址").fill("https://example.invalid/review");
  await btn(linkForm,"保存").click();
  await linkForm.waitFor({state:"hidden"});
  await a.reload();
  const reference=a.getByRole("link",{name:"复验文档"});
  await reference.waitFor();
  assert.equal(await reference.getAttribute("href"),"https://example.invalid/review");
  await btn(a,"移除链接 复验文档").click();await btn(a.getByRole("dialog"),"取消").click();
  await reference.waitFor();
  await btn(a,"移除链接 复验文档").click();await btn(a.getByRole("dialog"),"移除链接").click();
  await reference.waitFor({state:"hidden"});
  const selectFile = a.waitForEvent("filechooser");
  await btn(a,"添加任务附件").click();
  await (await selectFile).setFiles({name:"检查记录.txt",mimeType:"text/plain",buffer:Buffer.from("项目交接验收")});
  const comment = a.locator(".v3-fixed-comment");
  await comment.locator(".team-file-chip").filter({hasText:"检查记录.txt"}).waitFor();
  const commentText = "交接验收 " + stamp;
  await comment.getByRole("textbox").fill(commentText);
  await comment.getByRole("textbox").press("Control+Enter");
  const posted = a.locator(".team-entry-row").filter({hasText:commentText});
  await posted.getByText("检查记录.txt",{exact:true}).waitFor();
  await a.reload();
  await posted.getByText("检查记录.txt",{exact:true}).waitFor();
  assert.equal(await posted.count(),1);
  console.log("PASS 任务详情操作菜单和取消删除、订阅与重载、关联链接输入错误及保存名称、取消和确认移除、附件评论快捷键提交与刷新读取");
  await btn(a,"浏览全部视图").click();
  await heading(a,"全部视图").waitFor();
  await btn(a,"新建视图").click();
  const savedPanel=a.getByRole("dialog",{name:"全部视图"});
  const viewTitle="验收显示配置"+stamp;
  await savedPanel.getByPlaceholder("视图名称").fill(viewTitle);
  await btn(savedPanel,"保存当前设置").click();await heading(a,viewTitle).waitFor();
  const savedHash=new URL(a.url()).hash;
  await a.reload();await heading(a,viewTitle).waitFor();assert.equal(new URL(a.url()).hash,savedHash);
  await btn(a,"显示").click();await btn(a,"管理自定义视图").click();
  await savedPanel.getByPlaceholder("视图名称").fill(viewTitle+"副本");await btn(savedPanel,"复制为新视图").click();
  await heading(a,viewTitle+"副本").waitFor();assert.notEqual(new URL(a.url()).hash,savedHash);
  await btn(a,"显示").click();await btn(a,"管理自定义视图").click();await btn(savedPanel,"删除视图").click();
  const removal=a.getByRole("dialog",{name:"删除视图"});await btn(removal,"取消").click();
  await btn(savedPanel,"删除视图").click();await btn(removal,"确认删除").click();
  await btn(a,"浏览全部视图").click();await btn(a,viewTitle).waitFor();assert.equal(await btn(a,viewTitle+"副本").count(),0);
  await btn(a,"我的任务").click();
  const myScope=a.getByRole("combobox",{name:"当前视图"});await myScope.waitFor();
  assert.equal(await myScope.inputValue(),"assigned");
  await a.getByText("评审本周我负责的临时事项",{exact:true}).first().waitFor();
  await a.screenshot({path:resolve(artifacts,"demo-mine.png"),animations:"disabled"});
  await myScope.selectOption("my_agents");await a.waitForURL(u=>u.hash.includes("relation=my_agents"));
  await myScope.selectOption("all");await heading(a,"全部任务").waitFor();
  console.log("PASS 我的任务按本人及本人智能体切换，从视图回到全部任务");
  await btn(a, "全部任务").click();
  const board = a.locator(".v3-columns");
  const column = board.locator("section").filter({
    has: a.locator(".v3-task-card").filter({ hasText: "实现上传重试去重" }),
  });
  const cards = column.locator(".v3-task-card");
  await cards.nth(1).waitFor();
  const clickedCard=cards.first(), clickedId=await clickedCard.getAttribute("data-task-id");
  await clickedCard.locator("header small").click();
  await a.waitForURL(url=>url.href.includes("/issue/"+clickedId));
  await btn(a,"返回看板").click();await cards.nth(1).waitFor();
  const moved = await cards.nth(1).getAttribute("data-task-id");
  await cards.nth(1).dragTo(cards.first());
  await a.waitForFunction(
    (id) =>
      document
        .querySelector('[data-task-id="' + id + '"]')
        ?.parentElement?.querySelector("[data-task-id]")
        ?.getAttribute("data-task-id") === id,
    moved,
  );
  await a.reload();
  await board.waitFor();
  assert.equal(await cards.first().getAttribute("data-task-id"), moved);
  await column.getByRole("button", { name: /列菜单$/ }).click();
  await btn(column, "添加任务").click();
  dialog = a.getByRole("dialog").last();
  await dialog
    .getByRole("textbox")
    .first()
    .fill("可筛选任务" + stamp);
  await dialog.getByRole("combobox", { name: "优先级" }).click();
  await a.getByRole("option", { name: "高", exact: true }).click();
  await dialog.locator("summary").filter({ hasText: "更多选项" }).click();
  await dialog.getByLabel("开始日期").fill("2026-12-02");
  await dialog.getByLabel("截止日期").fill("2026-12-01");
  await dialog.getByText("截止日期不能早于开始日期").waitFor();
  assert.equal(await btn(dialog, "创建任务").isDisabled(), true);
  await dialog.getByLabel("截止日期").fill("2026-12-05");
  await dialog.getByLabel("标签", { exact: true }).fill("联调,验收");
  await btn(dialog, "创建任务").click();
  await heading(a, "可筛选任务" + stamp).waitFor();
  await btn(a,"编辑任务描述").click();
  await a.getByRole("textbox",{name:"编辑任务描述"}).fill("**显示描述样例**");
  await btn(a,"保存描述").click();
  await a.getByRole("textbox",{name:"编辑任务描述"}).waitFor({state:"hidden"});
  await btn(a, "全部任务").click();
  await btn(a, "显示").click();
  await btn(a, "表格").click();await a.locator("table[aria-label=任务表格]").waitFor();await a.keyboard.press("Escape");
  await a.locator("tr[data-task-id]").first().waitFor();
  const editable=a.locator("tr[data-task-id]").filter({has:a.getByRole("button",{name:"可筛选任务"+stamp,exact:true})});
  const tableIssueId=await editable.getAttribute("data-task-id");
  await editable.locator('[data-column="title"] small').click();
  await a.waitForURL(url=>url.href.includes("/issue/"+tableIssueId));
  await btn(a,"返回看板").click();await editable.waitFor();
  const dueCell=editable.locator('[data-column="due_date"] button');
  const calendar=a.locator(".v3-date-calendar");
  const typedDate=calendar.getByRole("textbox");
  await dueCell.click();
  await typedDate.fill("2026-12-01");await typedDate.press("Enter");
  await calendar.getByRole("alert").filter({hasText:"截止日期不能早于开始日期"}).waitFor();
  await typedDate.fill("2026-12-07");await typedDate.press("Enter");
  await dueCell.filter({hasText:"2026-12-07"}).waitFor();
  await a.reload();await dueCell.filter({hasText:"2026-12-07"}).waitFor();
  await btn(a,"显示").click();
  const displayPanel=a.getByRole("dialog",{name:"显示选项"});
  await displayPanel.getByRole("button",{name:"标签",exact:true,pressed:false}).click();
  await displayPanel.getByRole("button",{name:"标签",exact:true,pressed:true}).waitFor();
  await btn(a,"显示").click();
  const taskMenu=() => editable.getByRole("button",{name:/任务操作/}).click();
  await taskMenu(); await a.getByRole("menuitem",{name:"选择任务"}).click();
  assert.equal(await editable.getByRole("checkbox").isChecked(),true);
  await btn(a,"取消选择").click();
  await taskMenu(); await a.getByRole("menuitem",{name:"删除任务"}).click();
  await btn(a.getByRole("dialog",{name:"删除任务"}),"取消").click();await editable.waitFor();
  const pinSaved=a.waitForResponse(resp=>new URL(resp.url()).searchParams.get("path")==="/api/pins" && resp.request().method()==="POST");
  await taskMenu(); await a.getByRole("menuitem",{name:"置顶任务"}).click();
  assert.ok((await pinSaved).ok());
  await a.waitForFunction(title => document.querySelector("tbody tr[data-task-id]")?.textContent.includes(title),"可筛选任务"+stamp);
  await a.reload();await taskMenu();await a.getByRole("menuitem",{name:"取消置顶"}).click();
  await taskMenu();await a.getByRole("menuitem",{name:"编辑任务"}).click();
  await a.getByRole("dialog",{name:"编辑任务"}).waitFor();await a.keyboard.press("Escape");
  await a.getByRole("button",{name:"返回看板",exact:true}).click();await editable.waitFor();
  await taskMenu();await a.getByRole("menuitem",{name:"复制任务"}).click();
  const copyTitle="可筛选任务"+stamp+"（副本）";
  await heading(a,copyTitle).waitFor();
  await a.getByRole("button",{name:"返回看板",exact:true}).click();
  const copyRow=a.locator("tbody tr").filter({has:a.getByRole("button",{name:copyTitle,exact:true})});
  await copyRow.getByRole("button",{name:/任务操作/}).click();
  await a.getByRole("menuitem",{name:"删除任务"}).click();
  await btn(a.getByRole("dialog",{name:"删除任务"}),"确认删除").click();
  await copyRow.waitFor({state:"detached"});await editable.waitFor();
  const tagsCell=editable.locator('[data-column="labels"] input');
  await tagsCell.fill("验收, 表内联调");
  const labelResponse = a.waitForResponse(response => {
    const route = new URL(response.url()).searchParams.get("path") || "";
    return route.endsWith("/labels") && response.request().method() === "POST";
  });
  await tagsCell.press("Enter");
  const labelSaved = await labelResponse;
  assert.equal(labelSaved.status(),200,await labelSaved.text());
  await a.reload();
  await a.waitForFunction(() => Array.from(document.querySelectorAll(".v3-table-labels")).some(el=>el.value.includes("表内联调")));
  assert.match(await tagsCell.inputValue(),/验收/);
  const choose = async (name, option) => {
    const comb = a.getByRole("combobox", { name: "筛选" + name, exact: true });
    await comb.click();
    await a.getByRole("listbox").getByRole("option", { name: option, exact: true }).click();
    await comb.press("Escape");
  };
  await choose("项目", "无关联项目");
  await choose("优先级", "高");
  await choose("标签", "验收");
  await a.getByLabel("搜索任务", { exact: true }).fill("可筛选任务" + stamp);
  await a
    .locator("tbody tr")
    .filter({ hasText: "可筛选任务" + stamp })
    .waitFor();
  assert.equal(await a.locator("tbody tr").count(), 1);
  const table = a.locator("table");
  for (const name of ["负责人", "优先级", "截止日期"]) {
    const sort = btn(table, name);
    await sort.click();
    await table
      .locator("th[aria-sort=ascending]")
      .getByRole("button", { name, exact: true })
      .waitFor();
    await sort.click();
    await table
      .locator("th[aria-sort=descending]")
      .getByRole("button", { name, exact: true })
      .waitFor();
  }
  await a.getByLabel("选择本页").check();
  await btn(a, "删除").click();
  await btn(a.getByRole("dialog").last(), "取消").click();
  await btn(a, "取消选择").click();
  const download = a.waitForEvent("download");
  await btn(a, "导出 CSV").click();
  const csvPath = resolve(artifacts, "task-filter.csv");
  await (await download).saveAs(csvPath);
  const csv = await readFile(csvPath, "utf8");
  assert.match(csv, new RegExp("可筛选任务" + stamp));
  assert.equal(csv.trim().split(/\r?\n/).length, 2);
  assert.match(csv,/表内联调/);
  await btn(a, "清除全部").click();
  await a.locator("tbody tr").filter({ hasText: "整理交付清单" }).waitFor();
  const layoutMenu=()=>btn(a,"显示").click();
  await layoutMenu();
  await a.getByRole("combobox",{name:"表格分组"}).click(); await a.getByRole("option",{name:"项目",exact:true}).click();
  await layoutMenu();
  const groupHeading=a.locator(".v3-table-group").filter({hasText:"无关联项目"}).getByRole("button");
  await groupHeading.click();
  assert.equal(await editable.count(),0);
  await groupHeading.click();await editable.waitFor();
  await layoutMenu();await btn(a,"列表").click();await a.keyboard.press("Escape");
  const listRow=a.locator(".v3-list-row").filter({hasText:"可筛选任务"+stamp});
  await listRow.waitFor();
  const editId=await listRow.getAttribute("data-task-id");
  await listRow.getByRole("checkbox").check();
  await btn(a,"取消选择").click();
  await layoutMenu();await btn(a,"泳道").click();await a.keyboard.press("Escape");
  await layoutMenu();await a.getByRole("combobox",{name:"泳道分组"}).click();await a.getByRole("option",{name:"项目",exact:true}).click();await layoutMenu();
  const cell=a.locator('.v3-swim-cell[data-lane="none"][data-status="in_progress"]');
  const movedCard=a.locator('.v3-swim-cell [data-task-id="'+editId+'"]');
  await movedCard.waitFor();
  await layoutMenu();
  for (const property of ["开始日期","标签","描述"]) {
    const chip = btn(displayPanel,property);
    assert.equal(await chip.getAttribute("aria-pressed"),"false");
    await chip.click();
    await displayPanel.getByRole("button",{name:property,exact:true,pressed:true}).waitFor();
  }
  await a.keyboard.press("Escape");
  await movedCard.getByText("显示描述样例",{exact:true}).waitFor();
  await movedCard.getByText("表内联调",{exact:true}).waitFor();
  await movedCard.getByRole("button",{name:/开始日期/}).click();
  await typedDate.fill("2026-12-08");await typedDate.press("Enter");
  await calendar.getByRole("alert").waitFor();
  await a.keyboard.press("Escape");
  await calendar.waitFor({state:"detached"});
  const cardDue=movedCard.getByRole("button",{name:/截止日期/});
  await cardDue.click();
  await calendar.getByRole("button",{name:"2026-12-08",exact:true}).click();
  await cardDue.filter({hasText:"2026-12-08"}).waitFor();
  await movedCard.dragTo(cell,{sourcePosition:{x:12,y:10},targetPosition:{x:30,y:25}});
  await cell.locator('[data-task-id="'+editId+'"]').waitFor();
  await a.reload();await cell.locator('[data-task-id="'+editId+'"]').waitFor();
  await cell.getByRole("button",{name:/截止日期/}).filter({hasText:"2026-12-08"}).first().waitFor();
  console.log("PASS 表格与卡片共用日期编辑，非法日期取消、切换属性显示描述/标签/开始日期，泳道拖动后刷新保留");
  console.log("PASS 跨账号表内编辑与详情、日期和标签、任务菜单置顶/编辑/复制/选择/删除、分组收展和跨泳道拖动刷新");
  console.log(
    "PASS 看板同列拖动和刷新、按列新建、日期错误、标签、组合筛选、列排序切换、批量删除取消和筛选结果 CSV",
  );
  await btn(a, "新建").click();
  const box = a.locator(".wb-composer textarea");
  await box.fill("汇总项目进展");
  await box.press("Enter");
  await a.getByRole("button", { name: /固定/ }).last().click();
  const versions = a.getByRole("combobox", { name: "视图版本" });
  await versions.waitFor();
  const storedURL = a.url();
  await a
    .locator(".wb-pin-toolbar button")
    .filter({ hasText: /刷新/ })
    .first()
    .click();
  await a
    .locator('select[aria-label="视图版本"] option[value="2"]')
    .waitFor({ state: "attached", timeout: 30000 });
  await versions.selectOption("1");
  await a.getByRole("button", { name: /取消固定/ }).click();
  await a.waitForURL((url) => !url.hash.includes("pin="));
  await a.goto(storedURL);
  await heading(a, "这个视图已取消固定或不可访问").waitFor();
  await btn(a, "新建").click();
  await box.fill("在哪里查看我的文件");
  await box.press("Enter");
  await btn(a, "打开我的文件").click();
  const workspaceRoute = a.url().split("?")[0];
  await a
    .getByRole("button", { name: /弱网上传验收清单/ })
    .first()
    .waitFor();
  await a.setViewportSize({ width: 390, height: 844 });
  await btn(a, "展开侧栏").waitFor();
  const fileSearch = a.getByRole("textbox", { name: "搜索文件" });
  await fileSearch.fill("查无此文件");
  await a.getByText("没有匹配的文件").waitFor();
  assert.ok(
    await a.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "390 px 文件页横向溢出",
  );
  await btn(a, "清除筛选").click();
  await a.screenshot({ path: resolve(artifacts, "files-390.png") });
  await a.setViewportSize({width:1440,height:900});
  await btn(a,"云端网盘").click();
  await a.getByText(/云端网盘未接入/).waitFor();
  await btn(a,"任务成果").click();
  const filterFiles=a.getByRole("combobox",{name:"文件类型"});
  assert.deepEqual(await filterFiles.locator("option").allTextContents(),["全部类型","文档","表格","演示","PDF","图片","其他"]);
  await filterFiles.selectOption("表格");
  await a.getByText("没有匹配的文件").waitFor();
  await btn(a,"清除筛选").click();
  await btn(a,"新建").click();
  const attachments=a.getByLabel("添加会话附件");
  await attachments.setInputFiles(["检验表.CsV","审阅.pptx","文档.pdf","其他.bin"].map(name=>({name,mimeType:"application/octet-stream",buffer:Buffer.from(name)})));
  await a.locator(".wb-send").click();
  await a.locator(".wb-question").getByRole("button",{name:"检验表.CsV"}).click();
  const sheet=a.getByRole("dialog",{name:"检验表.CsV"});
  await sheet.getByText(/表格/).waitFor();
  await a.reload();await sheet.getByText(/表格/).waitFor();
  await a.keyboard.press("Escape");
  await a.reload();assert.equal(await sheet.count(),0);
  for(const [kind,name] of [["表格","检验表.CsV"],["演示","审阅.pptx"],["PDF","文档.pdf"],["其他","其他.bin"]]){
    await filterFiles.selectOption(kind);
    const fileRows=a.locator(".v3-files li button");
    await fileRows.getByText(name,{exact:true}).waitFor();
    for(const text of await fileRows.allTextContents()) assert.ok(text.includes(kind+" · "));
  }
  await filterFiles.selectOption("文档");
  await fileSearch.fill("  弱网上传验收清单  ");
  const taskFile=a.locator(".v3-files li button").filter({hasText:"确定弱网复现条件"}).first();
  await taskFile.click();
  const seededFile=a.getByRole("dialog",{name:"弱网上传验收清单.md"});
  await btn(seededFile,"查看来源").click();
  await a.locator(".team-located").getByText("弱网上传验收清单.md",{exact:true}).waitFor();
  console.log("PASS 文件类型与来源组合筛选、云盘说明、同名文件定位原评论、附件详情重载及取消后刷新");
  await a.setViewportSize({ width: 1440, height: 900 });
  await btn(a, "收起侧栏").waitFor();
  for (const retired of [
    "experts",
    "skills",
    "tools",
    "automation",
    "automation-runs",
    "skill-detail",
    "my-experts",
    "my-tools",
  ]) {
    await a.goto(workspaceRoute + "?view=" + retired);
    await a.waitForURL((url) => url.hash.endsWith("view=workbench"));
    await a.locator(".wb-welcome").waitFor();
  }
  console.log("PASS 固定历史切换、取消后旧链接、390 像素文件页、八条退役深链");

  // Use the signed-in Host to prepare an isolated, multi-page result set.
  const prefix = "paging" + stamp;
  const wsForPages = await a.evaluate(async (prefix) => {
    const root = "/api/workbench/transport?path=";
    const spaces = await (
      await fetch(root + encodeURIComponent("/api/workspaces"))
    ).json();
    const slug = location.hash.split("/team/")[1].split(/[/?]/)[0];
    const space = spaces.find((s) => s.slug === slug);
    for (let start = 0; start < 101; start += 5) {
      await Promise.all(
        Array.from({ length: Math.min(5, 101 - start) }, async (_, i) => {
          const result = await fetch(root + encodeURIComponent("/api/issues"), {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-workspace-id": space.id,
            },
            body: JSON.stringify({
              title: prefix + " " + String(start + i).padStart(3, "0"),
              suppress_run: true,
            }),
          });
          if (!result.ok) throw Error("无法准备分页任务 " + result.status);
        }),
      );
    }
    return space.id;
  }, prefix);
  await btn(a, "全部任务").click();
  await btn(a, "显示").click();
  await btn(a, "表格").click();await a.locator("table[aria-label=任务表格]").waitFor();await a.keyboard.press("Escape");
  await a.getByRole("textbox", { name: "搜索任务" }).fill(prefix);
  const rows = a.locator(".v3-table-wrap tbody tr");
  await rows.filter({ hasText: prefix }).first().waitFor();
  await rows.first().getByRole("checkbox").check();
  const firstName = (
    await rows.first().getByRole("button").first().innerText()
  ).match(new RegExp(prefix + " [0-9]+"))[0];
  await btn(a, "下一页").click();
  await a.waitForFunction(
    () => document.querySelectorAll(".v3-table-wrap tbody tr").length === 1,
  );
  await rows.first().getByRole("checkbox").check();
  const lastName = (await rows.first().innerText()).match(
    new RegExp(prefix + " [0-9]+"),
  )[0];
  assert.notEqual(firstName, lastName);
  await a.getByText("已选择 2 项", { exact: false }).first().waitFor();
  await a.getByRole("combobox", { name: "批量设置状态" }).selectOption("done");
  await a
    .getByRole("combobox", { name: "批量设置状态" })
    .waitFor({ state: "hidden" });
  await btn(a, "上一页").click();
  for (const title of [firstName, lastName]) {
    const status = await a.evaluate(
      async ({ ws, title }) => {
        const result = await fetch(
          "/api/workbench/transport?path=" +
            encodeURIComponent("/api/issues?q=" + encodeURIComponent(title)),
          { headers: { "x-workspace-id": ws } },
        );
        return (await result.json()).issues.find((i) => i.title === title)
          ?.status;
      },
      { ws: wsForPages, title },
    );
    assert.equal(status, "done");
  }
  console.log("PASS 跨页勾选和批量更新，两页所选任务均已保存");
  await verifyBlueprintCandidates(a,wsForPages,prefix);
  const offline = (requestURL) =>
    new URL(requestURL).searchParams.get("path")?.split("?")[0] ===
    "/api/projects";
  await a.route(
    (url) => offline(url.href),
    (request) =>
      request.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"隔离验收临时中断"}',
      }),
  );
  await btn(a.getByLabel("看板视图"), "全部项目").click();
  await a.reload();
  await a.locator(".team-connection-status").waitFor({ timeout: 30000 });
  await a.unrouteAll({ behavior: "wait" });
  await a.reload();
  await heading(a, "移动端弱网上传").waitFor();
  console.log("PASS 项目服务读取中断显示错误，连接恢复后重新读取真实项目");
  // Capture the four layouts in a newly seeded team before any QA edits or sorting.
  const previousTeamHash = new URL(a.url()).hash;
  await a.getByRole("combobox", {name:"工作区"}).click();
  await btn(a,"新建演示工作区").click();
  await a.waitForURL(url => url.hash !== previousTeamHash);
  await heading(a, "移动端弱网上传").waitFor();
  await btn(a,"全部任务").click();
  await heading(a,"全部任务").waitFor();
  for (const [label,selector,file] of [
    ["看板",".v3-task-card","task-board"],
    ["表格","tr[data-task-id]","demo-table"],
    ["列表",".v3-list-row","demo-task-list"],
    ["泳道",".v3-swim-cell [data-task-id]","demo-swimlane"],
  ]) {
    await btn(a,"显示").click();
    if (label === "看板") { await captureTaskControls(a,artifacts,"board-display");await a.screenshot({path:resolve(artifacts,"demo-board-display.png"),animations:"disabled"}); }
    await btn(a,label).click();
    if (label==="泳道") {
      const groupPicker=a.getByRole("combobox",{name:"泳道分组"});
      await groupPicker.click();
      const projectOption=a.getByRole("option",{name:"项目",exact:true});
      await projectOption.waitFor();await a.keyboard.press("Escape");
      await a.getByRole("listbox").waitFor({state:"hidden"});
      await a.getByRole("dialog",{name:"显示选项"}).waitFor();
      await groupPicker.click();await a.getByRole("option",{name:"项目",exact:true}).click();
      await a.getByRole("listbox").waitFor({state:"hidden"});
    }
    await a.keyboard.press("Escape");
    await a.getByRole("dialog",{name:"显示选项"}).waitFor({state:"hidden"});
    await a.locator(selector).first().waitFor();
    assert.ok(!(await a.locator(".v3-tasks").innerText()).includes("可筛选任务"+stamp));
    if (label === "表格") assert.match(await a.locator(selector).first().innerText(),/ANDR-105/);
    if (label === "列表") {
      const group = a.locator(".v3-task-list > section").first();
      assert.deepEqual(await group.locator(".v3-list-title").allTextContents(), ["验证重复上传回归", "补录尚未分配的验证项"]);
      await group.locator(".v3-status-mark").waitFor();
    }
    if (label === "泳道") {
      await a.locator(".v3-swim-cell [data-task-id]").filter({hasText:"评审本周我负责的临时事项"}).getByText("ANDR-111",{exact:true}).waitFor();
      await captureSwimlane(a,artifacts);
    }
    await a.screenshot({path:resolve(artifacts,file+".png"),animations:"disabled"});
  }
  await btn(a,"显示").click();
  const laneOptions = a.getByRole("dialog",{name:"显示选项"}).locator("section").first();
  for (const name of await laneOptions.getByRole("button",{pressed:true}).allTextContents()) await btn(laneOptions,name).click();
  await a.keyboard.press("Escape");
  await a.getByText("没有可显示的状态列，请在显示菜单中开启。",{exact:true}).waitFor();
  await btn(a,"显示").click(); await btn(a,"恢复默认显示").click();
  await a.keyboard.press("Escape"); await a.getByLabel("任务泳道").waitFor();
  console.log("PASS 泳道全部状态列隐藏的提示与恢复默认显示");
  console.log("PASS 第二个独立样例工作区的看板、表格、列表与项目泳道，未混入原团队新建任务");
  await btn(a,"新建").click();
  await box.fill("在哪里查看我的文件？");
  await box.press("Enter");
  await btn(a,"打开我的文件").click();
  await captureFiles(a,artifacts);
  const freshFiles = a.locator(".v3-files li button");
  const seededNames = await freshFiles.locator("strong").allTextContents();
  assert.deepEqual(seededNames.sort(),["弱网上传验收清单.md","弱网上传验收清单.md","灰度私聊备忘.txt"].sort());
  await a.mouse.move(1,1);
  await a.screenshot({path:resolve(artifacts,"demo-files.png"),animations:"disabled"});
  console.log("PASS 从新样例的 Work 知识卡打开我的文件，只有三条种子附件，两个同名清单各自保留来源");
  await btn(a,"全部项目").click();
  await heading(a,"新版发布准备").click();
  await btn(a,"施工蓝图").click();
  await btn(a,"加入已有任务").click();
  await captureBlueprintCandidates(a,artifacts);
  await a.screenshot({path:resolve(artifacts,"demo-blueprint-candidates.png"),animations:"disabled"});
  await a.keyboard.press("Escape");
  await btn(a,"查看变更并发布").click();
  const seededPreview = a.getByRole("dialog").last();
  await btn(seededPreview,"发布 V1").waitFor();
  await checkPanel(a,".mw-blueprint-preview",{x:340,width:760,header:66,blur:"blur(2px)"});
  await capturePublishPreview(a,artifacts);
  await a.screenshot({path:resolve(artifacts,"demo-blueprint-preview.png"),animations:"disabled"});
  await a.keyboard.press("Escape");
  await seededPreview.waitFor({state:"hidden"});
  await btn(a.getByLabel("看板视图"),"全部项目").click();
  await heading(a,"移动端弱网上传").click();
  await btn(a,/^任务 ?\d/).click();
  await a.locator(".project-task-list").getByRole("button",{name:/整理交付清单/}).first().click();
  const logPanel = a.locator(".v3-issue-inspector>details").filter({has:a.locator("summary",{hasText:"执行日志"})});
  await logPanel.locator("summary").first().click();
  await btn(logPanel,"运行智能体").click();
  const executeDialog = a.getByRole("dialog",{name:"请求智能体执行"});
  await btn(executeDialog,"确认").click();
  await a.locator(".v3-run-receipts article").first().waitFor({state:"attached"});
  if (await executeDialog.isVisible()) await btn(executeDialog,"取消").click();
  const requestRow = logPanel.locator(".v3-run-receipts article");
  assert.equal(await requestRow.count(),1);
  const receiptText = await requestRow.innerText();
  assert.match(receiptText,/请求编号 [0-9a-f-]{36}/);
  assert.match(receiptText,/入队失败|已加入执行队列/);
  await a.reload();
  await logPanel.locator("summary").first().click();
  await requestRow.waitFor();
  assert.equal(await requestRow.innerText(),receiptText);
  if (receiptText.includes("入队失败")) {
    await btn(requestRow,"重试执行").click();
    await btn(executeDialog,"取消").click();
    assert.equal(await requestRow.count(),1);
  }
  console.log("PASS 样例智能体从执行日志提交请求，按真实回执编号刷新回读，真人负责人运行按钮禁用");
  await verifyHistoricalTaskMembership(a);
  dialog=await settingsPage();
  await btn(dialog,"退出登录").click();await btn(sub("退出登录"),"确认退出").click();
  await a.locator('input[type="password"]').waitFor();
  await a.reload();await a.locator('input[type="password"]').waitFor();
  const afterLogout=await a.evaluate(async()=>(await fetch("/api/workbench/operation",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({operation:"session.current"})})).status);
  assert.ok([401,403].includes(afterLogout),"退出后服务端仍允许读取原会话");
  assert.ok(await btn(b,"账户菜单").isVisible());
  console.log("PASS 账户管理确认退出，刷新维持退出，原 Host 会话拒绝访问，另一账号保持登录");
} catch (error) {
  console.error(error);
  for (const [i, page] of pages.entries()) {
    await page
      .getByText("展开诊断信息", { exact: true })
      .first()
      .click({ timeout: 400 })
      .catch(() => {});
    await page.screenshot({ path: resolve(artifacts, "failed-" + i + ".png") });
    console.error((await page.locator("body").innerText()).slice(-1300));
  }
  throw error;
} finally {
  await browser?.close();
  for (const app of apps) {
    const cdp = await app.newBrowserCDPSession();
    await cdp.send("Browser.close").catch(() => {});
    await app.close();
  }
}
