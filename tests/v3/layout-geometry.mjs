import {createHash} from "node:crypto";
import {writeFile} from "node:fs/promises";
import {resolve} from "node:path";

async function captureGlyphs(page, output, scene, selectors) {
  const result = {};
  for (const [name,selector] of Object.entries(selectors)) {
    const attributes = await page.locator(selector).first().evaluate(svg => ({
      viewBox:svg.getAttribute("viewBox"), width:svg.getAttribute("width"), height:svg.getAttribute("height"),
      stroke:svg.getAttribute("stroke-width"),
      shapes:Array.from(svg.children, child=>[child.tagName,
        Object.fromEntries(Array.from(child.attributes).map(attr=>[attr.name,attr.value]).sort(([a],[b])=>a.localeCompare(b)))]),
    }));
    result[name] = createHash("sha256").update(JSON.stringify(attributes)).digest("hex");
  }
  await writeFile(resolve(output,"glyphs-"+scene+".json"),JSON.stringify(result,null,2)+"\n");
}

// Both the prototype and the installed product expose these visible form elements.
export async function captureManagementGeometry(page, section, output) {
  const selectors = section === "members"
    ? [".tm-settings-heading", ".tm-member-toolbar", ".tm-member-row"]
    : [".tm-settings-heading", ".tm-avatar-editor", ".tm-field>input", ".tm-field>textarea"];
  const metrics = await page.locator(".tm-settings-dialog").evaluate((dialog, selectors) =>
    Object.fromEntries(selectors.map(selector => [selector,
      Array.from(dialog.querySelectorAll(selector), element => {
        const rect = element.getBoundingClientRect();
        return [rect.x, rect.y, rect.width, rect.height].map(Math.round);
      }),
    ])), selectors);
  await writeFile(resolve(output, `geometry-${section}.json`), JSON.stringify(metrics, null, 2) + "\n");
  return metrics;
}

export async function captureDirectoryGeometry(page, section, output, reference = false) {
  const selectors = {
    页头:[".aw-heading",".mw-directory>header"],
    筛选栏:[".aw-toolbar",".directory-toolbar"],
    结果数:[".aw-result-caption",".directory-count"],
    首张卡片:[".aw-card",".directory-card"],
    卡片标题行:[".aw-card-top",".directory-card-top"],
    描述:[".aw-card-description",".directory-card>p"],
    页脚:[".aw-card-footer",".directory-card footer"],
    ...(section==="agents" ? {
      标签:[".aw-card-tags",".directory-tags"],
      执行端与模型:[".aw-card-meta",".directory-meta"],
    } : {
      队长:[".aw-leader",".directory-leader"],
      成员:[".aw-member-preview",".directory-members"],
    }),
  };
  await page.getByRole("heading",{name:section==="agents"?"智能体":"智能体小队",exact:true}).first().waitFor();
  const firstCard = reference ? ".aw-card" : ".directory-card";
  await page.locator(firstCard).first().waitFor();
  const metrics = await page.evaluate(({selectors,reference}) => Object.fromEntries(
    Object.entries(selectors).map(([name, choices]) => {
      const element = document.querySelector(choices[reference ? 0 : 1]);
      if (!element) throw Error("目录缺少控件 " + name);
      const box=element.getBoundingClientRect();
      return [name,[box.x,box.y,box.width,box.height].map(Math.round)];
    })),{selectors,reference});
  await writeFile(resolve(output,`geometry-${section}.json`), JSON.stringify(metrics,null,2)+"\n");
  const colors=await page.evaluate(({reference})=>{
    const color=(prototype,product,property)=>{
      const node=document.querySelector(reference?prototype:product);
      if (!node) throw Error("目录缺少配色采样控件 "+product);
      return getComputedStyle(node).getPropertyValue(property);
    };
    return {
      卡片背景:color(".aw-card",".directory-card","background-color"),
      卡片边框:color(".aw-card",".directory-card","border-top-color"),
      创建按钮:color(".aw-heading button",".mw-directory header button","background-color"),
      激活筛选:color(".aw-scope.aw-selected",".directory-scopes [aria-pressed=true]","color"),
    };
  },{reference});
  await writeFile(resolve(output,`palette-${section}.json`),JSON.stringify(colors,null,2)+"\n");
  return metrics;
}

export async function captureRuntimeGeometry(page, output) {
  const metrics = await page.evaluate(() => {
    const origin = document.querySelector(".space-identity").getBoundingClientRect();
    const selectors = {容器:".space-runtime-frame", 面板:".rt-surface", 工具栏:".rt-toolbar", 表头:".rt-table-head"};
    return Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return [name, [box.x - origin.x, box.y - origin.y, box.width, box.height]];
    }));
  });
  await captureGlyphs(page,output,"runtime",{
    运行时:".rt-toolbar>svg", 本机图标:".rt-machine-row .icon-laptop", 在线标识:".rt-status .icon-wifi",
  });
  await writeFile(resolve(output, "geometry-runtime.json"), JSON.stringify(metrics,null,2) + "\n");
}

// Locator screenshots enclose fractional origins in an integer box. Capture
// the visible viewport at the element's actual CSS position and dimensions.
export async function captureRuntimePanel(page, locator, path) {
  await locator.scrollIntoViewIfNeeded();
  const clip = await locator.boundingBox();
  if (!clip) throw Error("运行时面板不可见");
  await page.screenshot({path, clip, scale:"css", animations:"disabled"});
}

export async function captureProjectControls(page, scene, output) {
  const shared = {页头:".pd-project-header", 页签:".pd-project-tabs"};
  const controls = scene === "blueprint" ? {
    草案页头:".project-plan-heading", 画布工具栏:".project-canvas-tools", 画布:".project-canvas",
    首个节点:".project-node", 属性栏:".project-inspector",
    查看可推进任务:".project-plan-heading .project-actions button:first-child",
    编辑草案:".project-plan-heading .project-actions button:last-child",
    框选任务:".project-canvas-tools button:first-child",
    定位任务:".project-canvas-tools [role=combobox],.project-canvas-tools .project-picker",
    缩小:'.project-canvas-tools button[aria-label="缩小"]',
    放大:'.project-canvas-tools button[aria-label="放大"]',
    适应画布:'.project-canvas-tools button[title="适应画布"]',
    版本历史:".project-canvas-tools>button:last-child",
  } : {
    任务区页头:".project-section-heading", 推进按钮:".project-section-heading .project-actions button", 列表:".project-task-list",
    首行:".project-task-list>button", 任务标题:".project-task-list strong",
    任务编号与负责人:".project-task-list small", 内部任务:".project-internal", 内部任务开关:".project-internal summary",
  };
  const metrics = await page.evaluate(selectors => {
    const result = {};
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", {colorSpace:"srgb", willReadFrequently:true});
    const rgba = color => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };
    for (const [name, selector] of Object.entries(selectors)) {
      const el = document.querySelector(selector);
      if (!el) throw Error("项目缺少控件 " + name);
      const r = el.getBoundingClientRect(), style = getComputedStyle(el);
      result[name] = {
        边界:[r.x, r.y, r.width, r.height],
        字号:style.fontSize, 行高:style.lineHeight, 字重:style.fontWeight,
        文字颜色:rgba(style.color), 背景:rgba(style.backgroundColor),
        下边框:parseFloat(style.borderBottomWidth) > 0 ? rgba(style.borderBottomColor) : null,
      };
    }
    return result;
  }, {...shared, ...controls});
  await writeFile(resolve(output, "controls-" + scene + ".json"), JSON.stringify(metrics,null,2) + "\n");
}

// Match corresponding task-detail controls by their visible function in each application.
export async function captureTaskDetail(page, output, prototype = false) {
  const selectors = {
    正文滚动区: [".wb-task-scroll",".v3-issue-scroll"],
    标题: [".wb-task-scroll>h1",".v3-issue-scroll>h1"],
    描述: [".wb-description",".v3-issue-brief"],
    附件工具: [".wb-description-tools",".v3-description-tools"],
    前置交付: [".project-task-handoff",".project-task-handoff"],
    动态标题: [".wb-detail-activity>header",".v3-activity-heading"],
    评论固定区: [".wb-fixed-reply",".v3-fixed-comment"],
    评论输入框: [".wb-comment-composer",".v3-fixed-comment .team-composer"],
    发起会话: [".co-ask-work",'.v3-issue-inspector>button[aria-label="发起会话"]'],
    任务来源: [".co-task-source",".v3-issue-source"],
    属性标题: [".co-properties-card>h2",".v3-issue-fields>h2"],
    状态选择: [".co-properties-card>label:nth-of-type(1) .mc-select-trigger",".v3-issue-fields>label:nth-of-type(1) .team-select-trigger"],
    负责人选择: [".co-properties-card>label:nth-of-type(2) .mc-select-trigger",".v3-issue-fields>label:nth-of-type(2) .team-select-trigger"],
    项目选择: [".co-properties-card>label:nth-of-type(3) .mc-select-trigger",".team-task-properties .team-field:nth-child(1) .team-select-trigger"],
    优先级选择: [".co-properties-card>label:nth-of-type(4) .mc-select-trigger",".team-task-properties .team-field:nth-child(2) .team-select-trigger"],
    截止日期: [".co-properties-card .mc-date-trigger",".v3-property-date"],
    更多属性: [".wb-add-properties",".v3-issue-extra-toggle"],
    唤醒与提醒: [".wb-inspector-section:first-of-type>summary",".v3-issue-inspector>details:first-of-type>summary"],
    执行日志: [".wb-inspector-section:nth-of-type(2)>summary",".v3-issue-inspector>details:nth-of-type(2)>summary"],
  };
  const boxes = {};
  for (const [name, pair] of Object.entries(selectors)) {
    const element = page.locator(pair[prototype ? 0 : 1]).first();
    await element.waitFor();
    const {x,y,width,height} = await element.boundingBox();
    boxes[name] = [x,y,width,height];
  }
  await captureGlyphs(page,output,"task-detail",{
    临时聊天:prototype ? ".co-ask-work>svg:first-child" : '.v3-issue-inspector>button[aria-label="发起会话"]>svg:first-child',
    会话加号:prototype ? ".co-ask-work>svg:last-child" : '.v3-issue-inspector>button[aria-label="发起会话"]>svg:last-child',
    日历:prototype ? ".co-properties-card .mc-date-trigger svg" : ".v3-property-date svg",
    更多属性:prototype ? ".wb-add-properties svg" : ".v3-issue-extra-toggle svg",
  });
  await writeFile(resolve(output,"geometry-task-detail.json"),JSON.stringify(boxes,null,2)+"\n");
  return boxes;
}

export async function captureBlueprintCandidates(page, output) {
  const dialog = page.getByRole("dialog", {name:"加入已有任务", exact:true});
  await dialog.locator(".project-candidate-list>button").first().waitFor();
  const boxes = await dialog.evaluate(async element => {
    await document.fonts.ready;
    await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
    const selectors = {
      外框:null, 页头:":scope>header,:scope>[data-slot=dialog-header]", 标题:"h2",
      正文:".mc-form-dialog-body,.mw-blueprint-dialog-body",
      搜索:"input", 列表:".project-candidate-list", 首行:".project-candidate-list>button",
      任务名:".project-candidate-list strong", 编号与项目:".project-candidate-list small",
    };
    return Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
      const control = selector ? element.querySelector(selector) : element;
      if (!control) throw Error("蓝图纳入已有任务缺少控件 " + name);
      const {x,y,width,height} = control.getBoundingClientRect();
      return [name, [x,y,width,height]];
    }));
  });
  await writeFile(resolve(output, "geometry-blueprint-candidates.json"), JSON.stringify(boxes,null,2) + "\n");
}

export async function captureVersionHistory(page, output) {
  const dialog = page.getByRole("dialog", {name:"版本历史", exact:true});
  await dialog.locator(".project-version li").first().waitFor();
  const boxes = await dialog.evaluate(async element => {
    await document.fonts.ready;
    await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
    const selectors = {
      外框:null, 页头:":scope>header,:scope>[data-slot=dialog-header]", 标题:"h2",
      正文:".mc-form-dialog-body,.mw-blueprint-dialog-body", 版本:".project-version",
      版本名:".project-version h3", 查看:".project-version button", 变更清单:".project-version ul",
      首项:".project-version li", 字段组:".project-field-diff", 末项:".project-version ul>li:last-child",
    };
    return Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
      const control = selector ? element.querySelector(selector) : element;
      if (!control) throw Error("蓝图版本历史缺少控件 " + name);
      const {x,y,width,height} = control.getBoundingClientRect();
      return [name, [x,y,width,height]];
    }));
  });
  await writeFile(resolve(output, "geometry-blueprint-history.json"), JSON.stringify(boxes,null,2) + "\n");
}

export async function capturePublishPreview(page, output) {
  const dialog = page.getByRole("dialog").last();
  const boxes = await dialog.evaluate(async element => {
    await Promise.all(element.getAnimations().map(a=>a.finished.catch(()=>{})));
    await document.fonts.ready;
    const selectors = {
      外框:null, 页头:":scope>header,:scope>[data-slot=dialog-header]", 标题:"h2",
      正文:".mc-form-dialog-body,.mw-blueprint-dialog-body",
      说明:".mc-form-dialog-body>p,.mw-blueprint-dialog-body>p", 变更列表:".project-change-list",
      首行:".project-change-list>div", 调整字段:"label", 调整说明:"textarea",
      发布:"button.team-primary,.mc-form-dialog-body>button:last-child",
    };
    return Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
      const el = selector ? element.querySelector(selector) : element;
      if (!el) throw Error("发布预览缺少控件 " + name);
      const box = el.getBoundingClientRect();
      return [name, [box.x,box.y,box.width,box.height]];
    }));
  });
  await writeFile(resolve(output,"geometry-publish-preview.json"),JSON.stringify(boxes,null,2)+"\n");
  return boxes;
}

export async function captureFiles(page, output) {
  await page.getByRole("button",{name:/弱网上传验收清单/}).first().waitFor();
  const controls = {
    标题:page.getByRole("heading",{name:"我的文件",exact:true}),
    范围:page.locator('[aria-label="文件范围"]'),
    类型:page.getByRole("combobox",{name:"文件类型"}),
    搜索:page.getByRole("textbox",{name:"搜索文件"}).locator(".."),
    首行:page.locator("li>button").filter({has:page.locator("strong")}).first(),
  };
  const boxes = {};
  for (const [label,el] of Object.entries(controls)) {
    const r=await el.boundingBox();
    boxes[label]=[r.x,r.y,r.width,r.height];
  }
  await writeFile(resolve(output,"geometry-files.json"),JSON.stringify(boxes,null,2)+"\n");
}

export async function captureHandoff(page, output) {
  const list=page.locator(".project-start-list");
  await list.locator("label").nth(1).waitFor();
  const controls=await list.evaluate(async el=>{
    const modal=el.closest('[role="dialog"]');
    await Promise.all(modal.getAnimations().map(a=>a.finished.catch(()=>{})));
    await document.fonts.ready;
    const row=el.querySelector("label");
    const items={外框:modal,版本:modal.querySelector(".project-plan-version"),清单:el,首项:row,
      勾选框:row.querySelector("input"),任务名:row.querySelector("div>strong"),负责人:row.querySelector("small"),
      推进条件:row.querySelector(".project-start-reason"),次项:el.querySelectorAll("label")[1],
      剩余数量:modal.querySelector('[role="status"]'),操作栏:modal.querySelector(".project-actions")};
    return Object.fromEntries(Object.entries(items).map(([name,item])=>{
      if(!item) throw Error("交接预览缺少控件 "+name);
      const r=item.getBoundingClientRect();
      return [name,[r.x,r.y,r.width,r.height]];
    }));
  });
  await writeFile(resolve(output,"geometry-handoff.json"),JSON.stringify(controls,null,2)+"\n");
}

export async function captureTaskControls(page, output, scene, reference=false) {
  const side=scene==="side-chat";
  const element=page.locator(side ? reference?".co-task-sidechat":".v3-side-chat"
    : reference?".wb-display-panel":".v3-display-options");
  const controls=side ? {
    关闭:["header button","header button"], 输入区:[".composer-root",".v3-side-composer"],
    输入框:["textarea","textarea"], 工具栏:[".composer-tools",".v3-side-actions"],
    附件:[".composer-upload",".v3-side-actions button"], 工作空间与权限:[".composer-footer",".v3-side-scope"],
    底部说明:[".co-composer-caption",".v3-side-input>small"],
  } : {
    布局:[".wb-display-layouts",".v3-layouts"], 分组行:["label","label"],
    分组选择:["label [role=combobox]","label [role=combobox]"], 列选项:["section","section"], 底部操作:["footer","footer"],
  };
  const boxes=await element.evaluate(async (root,{controls,reference})=>{
    await document.fonts.ready;
    return Object.fromEntries(Object.entries(controls).map(([key,selectors])=>{
      const node=root.querySelector(selectors[reference?0:1]);
      if(!node) throw Error("缺少任务控件 "+key);
      const r=node.getBoundingClientRect();
      return [key,[r.x,r.y,r.width,r.height]];
    }));
  },{controls,reference});
  await writeFile(resolve(output,"geometry-"+scene+".json"),JSON.stringify(boxes,null,2)+"\n");
}

export async function captureSwimlane(page, output, reference = false) {
  const lanes = page.getByLabel("任务泳道", {exact:true});
  const selectors = reference
    ? [".wb-swimlane-columns>div", ".wb-row-group-header", ".wb-swimlane-cell", ".wb-card"]
    : [".v3-swim-status>div", ".v3-group-heading", ".v3-swim-cell", ".v3-task-card"];
  const labels = ["状态列", "泳道标题", "首个单元格", "首张任务卡"];
  await page.evaluate(()=>document.fonts.ready);
  const boxes = {};
  for (const [i,selector] of selectors.entries()) {
    const box = await lanes.locator(selector).first().boundingBox();
    if (!box) throw Error("泳道控件未显示 " + labels[i]);
    boxes[labels[i]] = [box.x, box.y, box.width, box.height];
  }
  await writeFile(resolve(output,"geometry-swimlane.json"), JSON.stringify(boxes,null,2)+"\n");
}

export async function captureRoomSettings(page, output, reference=false) {
  const selectors = {
    名称输入框:[".co-conversation-settings section:first-of-type input",".room-management input[aria-label='会话名称'],.room-management section:first-of-type label input"],
    新建项目:[".co-conversation-settings input[aria-label='新项目名称']",".room-management input[aria-label='新项目名称']"],
    成员首行:[".co-settings-members>div",".room-member-list>div"],
    成员末行:[".co-settings-members>div:last-child",".room-member-list>div:last-child"],
    消息输入区:[".co-composer-wrap .composer",".room-composer"],
    消息输入框:[".co-composer-wrap textarea",".room-composer textarea"],
    工具栏:[".co-composer-wrap .composer-tools",".room-actions"],
  };
  const boxes = await page.evaluate(async({selectors,reference})=>{
    await document.fonts.ready;
    return Object.fromEntries(Object.entries(selectors).map(([label,pair])=>{
      const e=document.querySelector(pair[reference?0:1]);
      if(!e) throw Error("未找到会话设置控件 "+label);
      const r=e.getBoundingClientRect();
      return [label,[r.x,r.y,r.width,r.height]];
    }));
  },{selectors,reference});
  await writeFile(resolve(output,"geometry-room-settings.json"),JSON.stringify(boxes,null,2)+"\n");
}

export async function captureThemeColors(page, output, theme, reference=false) {
  const names = [
    "brand", "brand-50", "brand-light", "brand-bg", "home-page", "home-pane", "page", "surface", "dialog-surface",
    "gray-1", "gray-2", "gray-3", "gray-4", "gray-5", "gray-6", "gray-7", "gray-8", "gray-9", "gray-10",
    "hover", "divider", "row-active-bg", "composer-shell", "card-line", "workspace-card",
    "text-title", "text-body", "text-muted", "text-faint", "success", "success-normal", "approval-caution", "warning", "danger", "account-card-text",
  ];
  const colors=await page.locator(reference?"html":".team-root").first().evaluate((root,names)=>{
    const tokenStyle=getComputedStyle(root);
    const probe=document.createElement("span");
    root.appendChild(probe);
    try {
      return Object.fromEntries(names.map(name=>{
        const variable="--mw-"+name;
        if(!tokenStyle.getPropertyValue(variable).trim()) throw Error("主题缺少颜色 "+variable);
        probe.style.color="var("+variable+")";
        return [name,getComputedStyle(probe).color];
      }));
    } finally { probe.remove(); }
  },names);
  await writeFile(resolve(output,"theme-"+theme+".json"),JSON.stringify(colors,null,2)+"\n");
}
