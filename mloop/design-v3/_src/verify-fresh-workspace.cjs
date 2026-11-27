// End-to-end prototype walkthrough, using real UI actions in a fresh browser context.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.MLOOP_URL || 'http://localhost:8086';
const run = async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const a = await ctx.newPage();
  const errors = [], checks = [];
  const watch = (p, label) => { p.setDefaultTimeout(4500); p.on('pageerror', e => errors.push(label + ': ' + e.stack)); };
  watch(a, 'A');
  const pass = name => { checks.push(name); console.log('PASS', name); };
  const btn = (p, name) => p.getByRole('button', { name, exact: typeof name === 'string' });
  const tab = (p, name) => p.getByRole('tab', { name, exact: typeof name === 'string' });
  const link = (p, name) => p.getByRole('link', { name, exact: typeof name === 'string' });
  const lab = (p, name) => p.getByLabel(name, { exact: true });
  const act = (p, action, id) => p.locator(`[data-action="${action}"]${id ? `[data-id="${id}"]` : ''}:visible`).first();
  const form = (p, name) => p.locator(`form[data-form="${name}"]:visible`);
  const submit = (p, name) => form(p, name).locator('button[type=submit]').click();
  const choose = async (p, name, option) => { await p.getByRole('combobox', { name, exact: true }).click(); await p.getByRole('option', {name: option, exact: true}).click(); };
  const closeToast = async p => { const close=btn(p,'关闭消息提醒'); if(await close.isVisible()) await close.click(); };
  const note = (p, text) => p.getByText(text, {exact:true}).first().waitFor();
  const msg = (p, text) => p.locator('.co-message.co-mine,.co-message.co-human-message').filter({hasText:text}).first().waitFor();
  const send = async (p, text) => { await lab(p, '会话消息').fill(text); await btn(p, '发送消息').click(); };
  const noSuggestion = async p => { const input=lab(p,'会话消息'); await input.waitFor(); assert(!(await input.getAttribute('placeholder')).includes('可以试试')); assert.equal(await btn(p,'填入建议').count(),0); };
  const clipboard = p => p.evaluate(() => navigator.clipboard.readText());
  const dismiss = async p => { await p.keyboard.press('Escape'); };
  const teamName='弱网验收组', project='弱网上传项目', task='修复弱网上传重试', checkTask='验证断网恢复后可重试';
  const agent='弱网验收助手', squad='弱网交付小队', member='yangchenhao@example.com', third='linzhixia@example.com';
  const ownerMessage='确认弱网时上传失败，要保留草稿并显示重试按钮。';
  const memberMessage='我负责验证断网恢复后重试，验收标准是同一个文件只上传一次。';
  const newChat = p => btn(p,'新建').click();
  let b,c;
  try {
    await a.goto(base+'/index.html?start=chat&team=product');
    const input=lab(a,'会话消息'); await input.waitFor();
    assert.equal(await input.inputValue(),'');
    const hint=await input.getAttribute('placeholder'); assert(hint.startsWith('可以试试：'));
    assert.notEqual(await input.evaluate(e=>getComputedStyle(e,'::placeholder').color),await input.evaluate(e=>getComputedStyle(e).color));
    await input.press('Enter'); assert(await btn(a,'发送消息').isDisabled());
    await btn(a,'填入建议').click(); assert.equal(await input.inputValue(),hint.slice('可以试试：'.length));
    await input.fill('我可以直接输入自己的内容'); assert.equal(await input.inputValue(),'我可以直接输入自己的内容');
    pass('首页灰色建议、不误发、点选只填入可编辑草稿');

    await btn(a,/^切换团队：/).click(); await btn(a,'创建团队').click();
    await a.getByPlaceholder('例如：产品研发团队').fill(teamName);
    await a.getByPlaceholder('简单介绍团队的目标与协作内容').fill('用弱网上传案例验证本地团队协作。');
    await btn(a,'创建团队').click(); await btn(a,'邀请成员').click();
    await a.waitForURL('**/work.html?**');
    const team=new URL(a.url()).searchParams.get('team');
    await btn(a,'邀请成员').click(); await lab(a,'邀请邮箱').fill(member+'\n'+third); await btn(a,'创建邀请').click();
    const copyInvite = async email => {await a.getByRole('region',{name:'待接受邀请'}).locator('.tm-member-row').filter({hasText:email}).getByRole('button',{name:'复制邀请'}).click(); const url=await clipboard(a); assert(new URL(url).searchParams.has('invite')); return url;};
    const invites=[await copyInvite(member),await copyInvite(third)]; assert.notEqual(invites[0],invites[1]);
    b=await ctx.newPage(); c=await ctx.newPage(); watch(b,'B');watch(c,'C');
    for(const [i,p,email,name] of [[0,b,member,'杨陈皓'],[1,c,third,'林知夏']]){
      await p.goto(invites[i]); await btn(p,'切换测试身份 · '+name).click();
      await note(p,'当前身份：'+email); await btn(p,'接受邀请').click();
      await note(p,'已接受邀请'); await btn(p,'关闭').click();
    }
    await tab(a,/^成员/).click();
    for(const email of [member,third]) await a.getByRole('region',{name:'团队成员'}).locator('.tm-member-row').filter({hasText:email}).waitFor();
    pass('创建空团队、创建两个邀请、独立标签页接受、所有者实时看到成员');
    await dismiss(a);

    const openIdentityPicker = async p => {
      await btn(p,'账户菜单').click(); await btn(p,'切换当前用户').click();
      return p.getByRole('dialog',{name:'切换当前用户',exact:true});
    };
    const picker=await openIdentityPicker(a);
    assert.match(await picker.locator('[aria-current=true]').innerText(),/肖叶茂/);
    await btn(picker,/杨陈皓/).click();
    assert.match(await btn(a,'账户菜单').innerText(),new RegExp(member));
    assert.match(await btn(c,'账户菜单').innerText(),new RegExp(third));
    await a.reload();
    assert.match(await btn(a,'账户菜单').innerText(),new RegExp(member));
    const memberPicker=await openIdentityPicker(a);
    assert.match(await memberPicker.locator('[aria-current=true]').innerText(),/杨陈皓/);
    await btn(memberPicker,/肖叶茂/).click();
    assert.match(await btn(a,'账户菜单').innerText(),/肖叶茂/);
    assert.match(await btn(b,'账户菜单').innerText(),new RegExp(member));
    pass('账户菜单切换当前用户、刷新保持、互不影响其他标签页');

    await link(a,'协作空间').click();
    await a.locator('a[href^="agents.html"]').first().click();
    await btn(a,'创建智能体').first().click();
    await a.locator('[data-action=wizard-runtime][data-harness=Codex]').click(); await submit(a,'wizard');
    await form(a,'wizard').locator('[name=name]').fill(agent);
    await form(a,'wizard').locator('[name=description]').fill('整理弱网上传问题和验收清单。');
    await form(a,'wizard').locator('[name=instructions]').fill('先复述已知条件，再按步骤列出验收标准。');
    await form(a,'wizard').locator('[name=access]').selectOption('整个工作区'); await submit(a,'wizard');
    await btn(a,'查看智能体').click(); await a.locator('.aw-detail-heading h1').filter({hasText:agent}).waitFor();
    const agentId=new URL(a.url()).searchParams.get('id'); assert(agentId);
    pass('从空智能体列表通过向导创建团队智能体');

    await btn(a,'设置').click();
    assert.equal(await tab(a,'Skills').count(),0); assert.equal(await tab(a,'MCP').count(),0);
    assert.equal(await tab(a,'会话能力').count(),0);
    await act(a,'settings-close').click();
    await btn(a,'对话').click(); await noSuggestion(a);
    assert.equal(await a.locator('.adaptive-composer').getAttribute('data-composer-kind'),'agent');
    for(const name of ['选择技能','选择工具']) assert.equal(await lab(a,name).count(),0);
    const privateAgent='请列出弱网上传重试的三条验收标准。';
    await send(a,privateAgent); await msg(a,privateAgent); await a.locator('.co-agent-message').first().waitFor();
    pass('智能体只保留基础配置、会话无模型覆写，私聊有演示回复');

    await a.goto(base+'/agents.html?team='+new URL(a.url()).searchParams.get('team'));
    await act(a,'open','builtin-work').click(); await a.locator('.aw-detail-heading h1').getByText('Work',{exact:true}).waitFor();
    await btn(a,'分配工作').click();
    const assignment='整理验收步骤';
    assert.equal(await a.getByRole('combobox',{name:'任务负责人'}).innerText(),'Work');
    await lab(a,'任务标题').fill(assignment); await btn(a,'创建任务').click();
    await a.locator('.aw-object-main').getByText(assignment,{exact:true}).waitFor();
    await btn(a,'对话').click(); await noSuggestion(a);
    assert.equal(await a.locator('.adaptive-composer').getAttribute('data-composer-kind'),'work');
    await send(a,'你好，帮我梳理验收流程。'); await a.locator('.co-agent-message').first().waitFor();
    pass('Work 是内置智能体，使用常规指派和对话入口');

    await link(a,'协作空间').click(); await a.locator('a[href^="squads.html"]').first().click();
    await btn(a,'创建小队').first().click(); await form(a,'squad').locator('[name=name]').fill(squad);
    await form(a,'squad').locator('[name=description]').fill('复现、修复并验证弱网上传重试。');
    await form(a,'squad').locator('[name=leader]').selectOption(agentId); await submit(a,'squad');
    await a.getByText(squad,{exact:true}).first().waitFor();
    await act(a,'add-member').click();
    await form(a,'add-member').locator('label').filter({hasText:member}).locator('input[type=checkbox]').check();
    await submit(a,'add-member'); await a.locator('.aw-member-list .aw-member-row').filter({hasText:member}).waitFor();
    await btn(a,'对话').click(); await noSuggestion(a); await a.getByText(squad,{exact:true}).first().waitFor();
    await send(a,'@'+agent+' 请把修复和验证拆成两步。'); await a.locator('.co-agent-message').first().waitFor();
    pass('创建小队、指定新智能体为队长、添加受邀成员并从小队进入对话');

    await newChat(a); await send(a,'请告诉我在哪邀请成员？');
    await a.getByRole('region',{name:'邀请成员入口'}).waitFor(); await btn(a,'打开邀请成员').click();
    await lab(a,'邀请邮箱').waitFor(); await btn(a,'取消').click(); await dismiss(a);
    pass('与个人 Work 对话、产品知识问答命中正确入口并打开真实操作弹窗');

    await newChat(a); await send(a,'@'+member+' 请私下确认验收安排。');
    const dmUrl=a.url(); assert(new URL(dmUrl).searchParams.has('conversation'));
    await b.goto(dmUrl); await msg(b,'请私下确认验收安排。'); await noSuggestion(b);
    await send(b,'我会负责验收。'); await msg(a,'我会负责验收。');
    await c.goto(dmUrl); await note(c,'无法访问此会话'); assert.equal(await lab(c,'会话消息').count(),0); assert.equal(await c.getByText('我会负责验收。',{exact:true}).count(),0);
    pass('人对人私聊双向同步，第三身份打不开私聊内容');
    await closeToast(a);
    await btn(a,'转为任务').click();
    const dmDraft=lab(a,'会话消息');
    await dmDraft.fill((await dmDraft.inputValue())+'\n\n核对私聊验收安排');
    await btn(a,'发送消息').click(); await link(a,'查看任务').click();
    await a.locator('.co-task-source a').waitFor();
    const privateTitle=await a.locator('.co-task-source a strong').innerText();
    await c.goto(a.url()); await note(c,'来源会话不可查看');
    assert.equal(await c.locator('.co-task-source a').count(),0);
    assert(!(await c.locator('.co-task-source').innerText()).includes(privateTitle));
    pass('非参与者打开团队任务时，不显示原始私聊标题或链接');

    await newChat(a); await send(a,'@'+member+' @'+third+' '+ownerMessage);
    const groupUrl=a.url();
    await a.addLocatorHandler(a.getByRole('button',{name:'关闭消息提醒',exact:true}),button=>button.click());
    await btn(a,'会话设置').click(); await lab(a,'会话名称').fill('弱网上传验收群');
    await lab(a,'新项目名称').fill(project); await btn(a,'创建并关联').click();
    await dismiss(a); await btn(a,'关闭会话设置').waitFor({state:'hidden'}); await noSuggestion(a);
    await b.goto(groupUrl); await c.goto(groupUrl); await msg(b,ownerMessage); await msg(c,ownerMessage);
    await send(b,memberMessage); await msg(a,memberMessage); await msg(c,memberMessage);
    await send(c,'确认验收后，把重试结果记录到看板。'); await msg(a,'确认验收后，把重试结果记录到看板。');
    pass('三身份群聊、标题和项目、三方消息同步');

    await closeToast(a);
    await btn(a,'打开临时 Work 聊天').click();
    const side=a.getByRole('complementary',{name:'Work 临时聊天'});
    await noSuggestion(side); await send(side,'总结关键结论');
    await side.getByText(/保留草稿并显示重试按钮/).first().waitFor({timeout:12000});
    assert.equal(await a.locator('.co-messages').first().getByText('总结关键结论',{exact:true}).count(),0);
    await btn(side,'关闭聊天').click(); await btn(a,'打开临时 Work 聊天').click();
    await lab(side,'会话消息').waitFor(); assert.equal(await side.getByText('总结关键结论',{exact:true}).count(),0);
    await btn(side,'关闭聊天').click();
    pass('临时右栏读取原群聊天，结果不写回原群，关闭后重开为空');

    await send(a,'@Work 总结群聊消息');
    await a.locator('.co-agent-message').getByText(/保留草稿并显示重试按钮/).first().waitFor({timeout:12000});
    pass('主动 @Work 在群里生成基于真实聊天记录的摘要');

    await btn(a,'转为任务').click(); assert((await input.inputValue()).startsWith('@Work '));
    await input.fill((await input.inputValue())+'\n\n'+task); await btn(a,'发送消息').click();
    const linked=link(a,'查看任务'); await linked.waitFor(); await linked.click();
    await a.getByRole('heading',{name:task,exact:true}).waitFor();
    const taskUrl=a.url();
    assert.equal(await tab(a,/会话|子任务/).count(),0);
    const source=a.locator('.co-task-source');
    assert.equal(await source.locator('a').count(),1);
    assert.equal(new URL(await source.locator('a').getAttribute('href'),taskUrl).searchParams.get('conversation'),new URL(groupUrl).searchParams.get('conversation'));
    await b.goto(taskUrl); await b.locator('.co-task-source a').waitFor();
    pass('原群内 @Work 创建任务，任务来源只显示创建时的原群');

    const recentBefore=await a.locator('a[href*="conversation="]').count();
    await btn(a,'发起会话').click();
    const thread=a.getByLabel('任务临时聊天',{exact:true}); await noSuggestion(thread);
    const resize=a.getByRole('separator',{name:'调整任务聊天宽度'});
    const rail=a.locator('#task-detail-rail'); const oldWidth=(await rail.boundingBox()).width;
    await resize.press('ArrowLeft'); assert((await rail.boundingBox()).width>oldWidth);
    const transientMessage='任务讨论：恢复网络后，应保留原草稿并使用同一上传记录。';
    await send(thread,transientMessage); await msg(thread,transientMessage);
    await thread.locator('.co-agent-message').first().waitFor();
    assert.equal(a.url(),taskUrl);
    for(const name of ['打开完整会话','转为任务','邀请成员']) assert.equal(await btn(thread,name).count(),0);
    await btn(thread,'关闭临时聊天').click(); await source.locator('a').waitFor();
    assert.equal(await a.locator('a[href*="conversation="]').count(),recentBefore);
    await btn(a,'发起会话').click(); await lab(thread,'会话消息').waitFor();
    assert.equal(await lab(thread,'会话消息').inputValue(),''); assert.equal(await thread.getByText(transientMessage,{exact:true}).count(),0);
    await lab(thread,'会话消息').fill('不会被记住的草稿');
    assert(await a.evaluate(()=>!Object.values(sessionStorage).includes('不会被记住的草稿')));
    assert(await a.evaluate(text=>!Object.values(localStorage).some(value=>value.includes(text)),transientMessage));
    await a.reload();
    assert.equal(await thread.count(),0); await btn(a,'发起会话').click(); await lab(thread,'会话消息').waitFor();
    assert.equal(await lab(thread,'会话消息').inputValue(),''); await btn(thread,'关闭临时聊天').click();
    pass('任务临时右栏不改网址、不进最近会话、不开放分享、关闭或刷新即清空');

    await choose(a,'详情任务状态','进行中');
    await link(a,'全部项目').click(); const projects=a.locator('.pd-project-grid');
    await projects.getByRole('link').filter({has:a.getByRole('heading',{name:project,exact:true})}).click();
    await a.getByRole('navigation',{name:'项目页面'}).getByRole('link',{name:/任务/}).click();
    await link(a,'全部任务').click();
    await btn(a,'新建任务').first().click();
    const manual=btn(a,'切换为手动创建');if(await manual.isVisible())await manual.click();
    await choose(a,'任务项目',project);
    await lab(a,'任务标题').fill(checkTask); await lab(a,'任务描述').fill('关闭网络，恢复后点击重试，检查文件不重复。');
    await btn(a,'创建任务').click();
    await a.locator('.wb-task-content').getByText(checkTask,{exact:true}).first().click();
    await a.locator('.co-task-source').getByText('没有来源会话').waitFor();
    await choose(a,'详情任务状态','已完成'); await btn(a,'返回看板').click();
    pass('全部项目可打开项目卡片，手工创建的独立任务无来源');

    await btn(a,'显示').click(); await a.getByText('看板',{exact:true}).last().click();
    await a.locator('.wb-column[data-group="进行中"] .wb-card').filter({hasText:task}).waitFor();
    pass('全部任务切换看板、查看真实任务及更新后状态');

    await newChat(a); await send(a,'查看「'+project+'」的整体进度');
    const preview=a.locator('.view-preview'); await preview.waitFor();
    await preview.getByText(task,{exact:true}).first().waitFor({timeout:12000});
    await preview.getByText(checkTask,{exact:true}).first().waitFor({timeout:12000});
    await send(a,'只看已完成'); await preview.getByText(checkTask,{exact:true}).first().waitFor({timeout:12000});
    await preview.getByText(task,{exact:true}).waitFor({state:'hidden',timeout:12000});
    await a.reload(); await preview.getByText(checkTask,{exact:true}).waitFor({timeout:12000});
    pass('统一会话动态看板读取本团队项目，跟随追问筛选，刷新恢复');
    for(const retired of ['automation','experts','skills-installed']) {
      await a.goto(base+'/'+retired+'.html?team='+team);
      await a.waitForURL(u=>u.pathname==='/index.html'&&u.searchParams.get('team')===team);
    }
    await send(a,'请告诉我定时任务和技能管理入口在哪？');
    assert.equal(await a.locator('.a2-entry-card').count(),0);
    pass('退役入口已下线，旧链接回到相同团队，知识问答不再推荐');
    await c.setViewportSize({width:390,height:844}); await c.goto(taskUrl);
    await c.locator('.co-task-source a').waitFor();
    await btn(c,'发起会话').click(); await c.getByLabel('任务临时聊天').waitFor();
    await btn(c,'关闭临时聊天').click(); await c.locator('.co-task-source a').waitFor();
    pass('窄屏同样保留任务来源和可关闭的临时侧栏');

    // Simulate a saved v4 workspace with the old task hierarchy, without modifying the real preview.
    const legacyUrl=(id)=>base+'/work.html?issue='+id+'&team='+team;
    await a.evaluate(team=>{
      const key='mw-multica-workspace-v4::team:'+team;
      const saved=JSON.parse(localStorage.getItem(key)||'{}');
      const defaults={description:'',status:'待办',priority:'无优先级',assignee:'无负责人',project:'',subscribed:true,pinned:false};
      saved.issues=[...(saved.issues||[]),{...defaults,id:81,title:'旧根任务'},{...defaults,id:82,parent:81,title:'从旧层级保留下来的任务'}];
      localStorage.setItem(key,JSON.stringify(saved));
    },team);
    await a.goto(legacyUrl(81));
    await a.getByRole('heading',{name:'旧根任务',exact:true}).waitFor();
    await btn(a,'任务操作').click(); await a.getByRole('menuitem',{name:'删除任务'}).click();
    await btn(a,'删除').click();
    await a.goto(legacyUrl(82));
    await a.getByRole('heading',{name:'从旧层级保留下来的任务',exact:true}).waitFor();
    assert.equal(await a.getByText('旧根任务',{exact:true}).count(),0);
    pass('读取旧任务为独立条目，删除原上级不级联删除');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true, checks, pageErrors:errors},null,2));
  } catch (error) {
    for(const [label,p] of [['A',a],['B',b],['C',c]]) if(p) {
      console.error(label,p.url(),(await p.locator('body').innerText()).slice(-3600));
    }
    console.error('Page errors:',errors); throw error;
  } finally { await browser.close(); }
};
run().catch(e=>{console.error(e);process.exitCode=1});
