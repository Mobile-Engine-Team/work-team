import {captureThemeColors,captureRoomSettings,captureSwimlane,captureTaskControls,captureHandoff,captureFiles,captureBlueprintCandidates,captureVersionHistory,capturePublishPreview,captureTaskDetail,captureManagementGeometry,captureDirectoryGeometry,captureRuntimeGeometry,captureRuntimePanel,captureProjectControls} from "./layout-geometry.mjs";
// Capture the read-only interaction reference in a disposable browser context.
import { chromium, _electron as electron } from "playwright";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const output=resolve(process.env.MW_V3_REFERENCE || ".local/v3-reference");
await mkdir(output,{recursive:true});
const executable = process.env.MW_V3_REFERENCE_ELECTRON;
const profile = executable ? await mkdtemp(resolve(tmpdir(), "mw-reference-")) : null;
let browser;
try {
  let page;
  if (executable) {
    browser = await electron.launch({executablePath:executable, args:[
      fileURLToPath(new URL("./reference-window.cjs", import.meta.url)), "--user-data-dir=" + profile,
    ]});
    page = await browser.firstWindow();
    await page.setViewportSize({width:1440, height:900});
  } else {
    browser = await chromium.launch({channel:process.env.MW_CHROME_CHANNEL || "chrome"});
    page = await browser.newPage({viewport:{width:1440, height:900}});
  }
  const capture=async key=>{
    await page.evaluate(async()=>{
      await document.fonts.ready;
      await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));
    });
    await page.screenshot({path:resolve(output,key+".png"),animations:"disabled"});
  };
  const rail=page.locator("aside").first();
  const open=async label=>rail.getByRole("link",{name:label,exact:true}).first().click();
  await page.goto("http://127.0.0.1:8086/");
  await page.getByRole("button",{name:/^切换团队/}).click();
  await page.getByRole("button",{name:/^新建演示工作区/}).click();
  await page.getByRole("heading",{name:"全部项目",exact:true}).waitFor();
  await capture("catalog");
  await page.getByRole("button",{name:"新建项目",exact:true}).first().click();
  await page.getByRole("dialog",{name:"新建项目"}).waitFor();
  await capture("project-create");await page.keyboard.press("Escape");
  await page.getByRole("heading",{name:"移动端弱网上传",exact:true}).click();
  await page.locator(".pd-project-body").waitFor();
  await capture("overview");
  await page.getByRole("button",{name:"项目设置",exact:true}).click();
  await page.getByRole("dialog",{name:"项目设置"}).waitFor();
  await capture("project-settings");await page.keyboard.press("Escape");
  await page.getByRole("navigation",{name:"项目页面"}).getByRole("link",{name:"施工蓝图"}).click();
  await page.locator(".project-node").first().waitFor();
  await captureProjectControls(page, "blueprint", output);
  await capture("blueprint");
  await page.getByRole("button",{name:"版本历史",exact:true}).click();
  await page.getByRole("dialog",{name:"版本历史"}).locator(".project-version").first().waitFor();
  await capture("blueprint-history");
  await captureVersionHistory(page,output);
  await page.keyboard.press("Escape");
  await page.getByRole("navigation",{name:"项目页面"}).getByRole("link",{name:/任务/}).click();
  await page.locator(".project-task-list").first().waitFor();
  await captureProjectControls(page, "project-tasks", output);
  await capture("project-tasks");
  await page.getByRole("button",{name:"查看可推进任务",exact:true}).click();
  await page.getByRole("dialog").last().waitFor();
  await captureHandoff(page,output);
  await capture("handoff");
  await page.keyboard.press("Escape");
  await page.locator(".project-task-list").getByRole("button",{name:/实现上传重试去重/}).first().click();
  await page.locator(".wb-detail").waitFor();await capture("task-detail");await captureTaskDetail(page,output,true);
  await page.getByRole("button",{name:"发起会话",exact:true}).click();
  await page.locator(".co-task-sidechat textarea").waitFor();
  await captureTaskControls(page,output,"side-chat",true);await capture("side-chat");
  await page.getByRole("button",{name:"关闭临时聊天",exact:true}).click();
  for(const [key,label] of [["board","全部任务"],["space","协作空间"],["agents","智能体"],["squads","智能体小队"]]){
    await open(label);
    await page.getByRole("heading",{name:label,exact:true}).first().waitFor();
    if(key==="agents" || key==="squads") await captureDirectoryGeometry(page,key,output,true);
    await capture(key);
    if(key==="board"){
      await page.getByRole("button",{name:"显示",exact:true}).click();
      await captureTaskControls(page,output,"board-display",true);await capture("board-display");
      await page.getByRole("button",{name:"表格",exact:true}).click();
      await page.keyboard.press("Escape");
      await page.locator(".wb-table tbody tr").first().waitFor();await capture("table");
      for(const [label,key] of [["列表","task-list"],["泳道","swimlane"]]){
        await page.getByRole("button",{name:"显示",exact:true}).click();
        await page.getByRole("button",{name:label,exact:true}).click();
        if(key==="swimlane"){
          await page.getByRole("combobox",{name:"泳道分组"}).click();
          await page.getByRole("option",{name:"项目",exact:true}).click();
        }
        await page.keyboard.press("Escape");if(key==="swimlane") await captureSwimlane(page,output,true);await capture(key);
      }
      await rail.getByRole("link",{name:/浏览全部视图/}).click();
      await page.locator(".wb-view-directory").getByRole("button",{name:/^我的任务/}).click();
      await page.getByRole("combobox",{name:"当前视图"}).waitFor();await capture("mine");
    }
    if(key==="space"){
      await page.getByRole("button",{name:"编辑空间资料",exact:true}).click();
      const panel=page.getByRole("dialog",{name:"团队设置"});
      await panel.getByRole("heading",{name:"基础信息"}).waitFor();await captureManagementGeometry(page, "team-settings", output);await capture("team-settings");
      await panel.getByRole("button",{name:/成员管理/}).click();
      await panel.locator(".tm-member-row").first().waitFor();await captureManagementGeometry(page, "members", output);await capture("members");
      await panel.getByRole("button",{name:"邀请成员",exact:true}).click();
      await page.getByRole("dialog",{name:"邀请成员"}).waitFor();await capture("invite");
      await page.keyboard.press("Escape");await page.keyboard.press("Escape");
      const runtime=page.locator(".rt-surface.rt-runtimes");
      await runtime.locator(".rt-machine-row").first().waitFor();
      await captureRuntimeGeometry(page, output);
      await captureRuntimePanel(page, runtime, resolve(output,"runtime-directory.png"));
      await runtime.locator(".rt-machine-row").first().click();
      await runtime.locator(".rt-child-row").first().waitFor();
      await captureRuntimePanel(page, runtime, resolve(output,"runtime-machine.png"));
      await runtime.locator(".rt-child-row").filter({hasText:"Codex"}).first().click();
      await runtime.getByRole("button",{name:"用量",exact:true}).waitFor();
      await captureRuntimePanel(page, runtime, resolve(output,"runtime-settings.png"));
    }
  }
  await rail.getByRole("link",{name:/弱网上传交付协作/}).first().click();
  await page.locator(".co-messages .co-file").first().waitFor();await capture("room");
  await page.getByRole("button",{name:"搜索会话消息"}).click();await capture("room-search");
  await page.getByRole("button",{name:"会话设置",exact:true}).click();
  await page.locator(".co-conversation-settings").waitFor();await captureRoomSettings(page,output,true);await capture("room-settings");
  await rail.getByRole("button",{name:"新建",exact:true}).click();
  await page.getByRole("heading",{name:"Mobile熠动，Work智简",exact:true}).waitFor();
  await capture("home");
  await page.getByRole("button",{name:/^通知，/}).click();
  await page.getByRole("dialog",{name:"通知中心"}).waitFor();
  await capture("notifications");await page.keyboard.press("Escape");
  await page.getByRole("button",{name:/^切换团队/}).click();
  await page.getByRole("dialog",{name:"切换团队"}).waitFor();
  await capture("switch");
  await page.keyboard.press("Escape");
  await open("全部项目");
  await page.getByRole("heading",{name:"新版发布准备",exact:true}).click();
  await page.getByRole("navigation",{name:"项目页面"}).getByRole("link",{name:"施工蓝图"}).click();
  await page.getByRole("button",{name:"加入已有任务",exact:true}).click();
  await captureBlueprintCandidates(page,output);
  await capture("blueprint-candidates");
  await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"查看变更并发布",exact:true}).click();
  await page.getByRole("dialog").getByRole("button",{name:"发布 V1",exact:true}).waitFor();
  await capture("blueprint-preview");
  await capturePublishPreview(page,output);
  await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"账户菜单"}).click();await page.getByRole("button",{name:"设置",exact:true}).click();
  for(const [label,key] of [["账户管理","account"],["系统设置","system"],["个性化","personalization"],["帮助与反馈","help"]]){
    const panel=page.getByRole("dialog",{name:"设置",exact:true});
    await panel.getByRole("link",{name:label,exact:true}).click();
    await panel.getByRole("heading",{name:label,exact:true}).waitFor();
    await panel.screenshot({path:resolve(output,"preferences-"+key+".png"),animations:"disabled"});
    if(key==="system"){
      for(const [label,theme] of [["浅色","light"],["深色","dark"]]) {
        await panel.getByRole("button",{name:label,exact:true}).click();
        await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
        await captureThemeColors(page,output,theme,true);
      }
      await panel.getByRole("button",{name:"浅色",exact:true}).click();
    }
  }
  await page.keyboard.press("Escape");
  await rail.getByRole("button",{name:"新建",exact:true}).click();
  const input=page.getByRole("textbox",{name:"会话消息"});
  await input.fill("在哪里查看我的文件？");
  await input.press("Enter");
  await page.getByText("打开我的文件",{exact:true}).click();
  await captureFiles(page,output);await capture("files");
  console.log("PASS 从新建演示工作区采集项目、蓝图、任务、临时聊天、目录和文件画面，以及运行时和个人设置面板");
} finally {
  await browser?.close();
  if (profile) await rm(profile, {recursive:true, force:true});
}
