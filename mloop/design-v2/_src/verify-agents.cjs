const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const base=process.env.MLOOP_URL||'http://127.0.0.1:8000';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage();const errors=[];const checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 const visit=async route=>{await page.goto(base+'/'+route);await page.locator('.design-module-header').waitFor();};
 const click=async (a,id)=>page.locator(`[data-action="${a}"]${id?`[data-id="${id}"]`:''}`).first().click();
 const submit=async form=>page.locator(`form[data-form="${form}"] button[type="submit"],form[data-form="${form}"] button:not([type])`).last().click();
 const dialog=()=>page.locator('dialog[open]');
 const store=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mw-expert-agents-v1')));
 try{
  for(const route of ['skills','skills-installed','experts','tools']){
   await visit(route+'.html');assert.deepEqual(await page.locator('.design-module-header>div:first-child button').allTextContents(),['技能','专家','工具','智能体']);
   await page.getByRole('button',{name:'智能体',exact:true}).click();await page.waitForURL('**/agents.html');await page.locator('.aw-card').first().waitFor();
  }checks.push('技能、已安装技能、专家、工具入口和智能体导航');
  assert.equal(await page.locator('.aw-card').count(),6);
  await page.getByRole('textbox',{name:'搜索智能体'}).fill('前端');assert.equal(await page.locator('.aw-card').count(),1);
  await page.getByRole('textbox',{name:'搜索智能体'}).fill('不存在');assert.equal(await page.locator('.aw-card').count(),0);
  await click('reset');await page.getByLabel('状态筛选').selectOption('离线');assert.equal(await page.locator('.aw-card').count(),1);
  await page.getByLabel('状态筛选').selectOption('全部状态');await click('scope','我的');assert.equal(await page.locator('.aw-card').count(),4);await click('scope','全部');
  await click('layout','list');assert.equal(await page.locator('.aw-table tbody tr').count(),6);await page.reload();await page.locator('.aw-table').waitFor();await click('layout','grid');checks.push('搜索、状态、我的智能体筛选及视图偏好持久化');
  await click('create');await dialog().locator('[name=name]').fill('验收助手');await dialog().locator('[name=description]').fill('用于验证配置保存与任务记录');
  await dialog().locator('[name=access]').selectOption('指定成员');await submit('agent');assert.match(await dialog().innerText(),/至少选择一位/);
  await dialog().locator('[name=allowed]').first().check();await submit('agent');await page.locator('.aw-detail-heading h1').waitFor();assert.equal(await page.locator('.aw-detail-heading h1').innerText(),'验收助手');const agentId=new URL(page.url()).searchParams.get('id');
  await click('detail-tab','指令');await page.locator('[name=instructions]').fill('先明确验收标准，再执行检查。');await submit('instructions');await page.reload();await page.locator('.aw-detail-heading').waitFor();await click('detail-tab','指令');assert.equal(await page.locator('[name=instructions]').inputValue(),'先明确验收标准，再执行检查。');
  await click('detail-tab','技能');await page.locator('[name=skills][value="代码审查"]').check();await submit('skills');assert.ok((await store()).agents.find(a=>a.id===agentId).skills.includes('代码审查'));
  await click('edit');await dialog().locator('[name=name]').fill('验收助手 V2');await submit('agent');assert.equal(await page.locator('.aw-detail-heading h1').innerText(),'验收助手 V2');checks.push('创建、编辑、访问成员校验、指令、技能和刷新持久化');
  await click('task');await dialog().locator('[name=title]').fill('回归新增智能体页面');await submit('task');assert.match(await page.locator('.aw-task-list').innerText(),/回归新增智能体页面/);
  await click('task-detail');await dialog().locator('[name=status]').selectOption('已完成');await submit('task-status');assert.match(await page.locator('.aw-task-list').innerText(),/已完成/);checks.push('分配演示任务、查看任务及更新状态');
  await click('duplicate');await submit('agent');assert.equal(await page.locator('.aw-detail-heading h1').innerText(),'验收助手 V2 副本');const copyId=new URL(page.url()).searchParams.get('id');
  await click('archive');await submit('archive');await click('scope','已归档');assert.equal(await page.locator('.aw-card').count(),1);await click('open',copyId);await click('restore');assert.equal((await store()).agents.find(a=>a.id===copyId).archived,false);checks.push('复制、归档、归档列表和恢复智能体');
  await visit('agents.html?id=mika');await click('archive');assert.match(await dialog().innerText(),/先更换小队队长/);await page.keyboard.press('Escape');assert.equal(await dialog().count(),0);checks.push('队长归档保护和弹窗 Escape 关闭');
  await visit('squads.html');assert.equal(await page.locator('.aw-card').count(),3);await click('create');await dialog().locator('[name=name]').fill('验收小队');await dialog().locator('[name=leader]').selectOption(agentId);await submit('squad');const squadId=new URL(page.url()).searchParams.get('id');assert.equal((await store()).squads.find(s=>s.id===squadId).members.length,1);
  await click('add-member');await dialog().locator('[name=members][value="agent:frontend"]').check();await dialog().locator('[name=members][value="human:me"]').check();await submit('add-member');assert.equal(await page.locator('.aw-members-table tbody tr').count(),3);
  await click('role','human:me');await dialog().locator('[name=role]').fill('负责最终验收');await submit('role');assert.match(await page.locator('.aw-members-table').innerText(),/负责最终验收/);
  await page.getByLabel('小队队长').selectOption('product');await click('leader');assert.equal(await page.locator('.aw-members-table tbody tr').count(),4);assert.equal((await store()).squads.find(s=>s.id===squadId).leader,'product');assert.equal(await page.getByLabel('移除产品规划助手',{exact:true}).count(),0);
  await click('remove-member','agent:frontend');await submit('remove-member');assert.equal(await page.locator('.aw-members-table tbody tr').count(),3);
  await page.locator('[name=instructions]').fill('队长拆分任务，验收通过后交付。');await submit('instructions');await page.reload();await page.locator('.aw-members-table').waitFor();assert.equal(await page.locator('[name=instructions]').inputValue(),'队长拆分任务，验收通过后交付。');checks.push('创建小队、自动加入队长、添加人类和智能体、角色编辑、更换队长、移除成员和保存指令');
  await click('members');await click('new-human');await dialog().locator('[name=name]').fill('测试成员');await dialog().locator('[name=email]').fill('test@example.com');await submit('human');assert.match(await dialog().innerText(),/测试成员/);await page.keyboard.press('Escape');checks.push('工作区演示成员管理，无设置页面');
  await click('task');await dialog().locator('[name=title]').fill('小队归档任务交接');await submit('task');await click('archive');await submit('archive');const archived=await store();assert.equal(archived.squads.find(s=>s.id===squadId).archived,true);assert.ok(archived.tasks.some(t=>t.title==='小队归档任务交接'&&t.kind==='agent'&&t.target==='product'));await visit('squads.html?id='+squadId);assert.match(await page.locator('.aw-empty').innerText(),/未找到小队/);checks.push('归档小队后任务转交原队长，归档小队不再可编辑');
  await visit('agents.html');await click('create');await dialog().locator('[name=name]').fill('<img src=x onerror=alert(1)>');await submit('agent');assert.equal(await page.locator('.aw-detail-heading h1').innerText(),'<img src=x onerror=alert(1)>');assert.equal(await page.locator('.aw-detail-heading img').count(),0);checks.push('用户输入转义');
  for(const viewport of [{width:1440,height:900},{width:1280,height:800},{width:390,height:844}]){
   await page.setViewportSize(viewport);for(const route of ['agents.html','squads.html','squads.html?id=delivery','agents.html?id=mika']){await visit(route);await page.locator('agent-workspace h1').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,route+' '+viewport.width);if(viewport.width<760)assert.equal(await page.locator('.design-sidebar').isVisible(),false);assert.equal(await page.locator('.design-panel').evaluate(el=>getComputedStyle(el).overflowY),'auto');assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.some(i=>i.complete&&i.naturalWidth===0)),false);}
  }checks.push('1440、1280、390 宽度布局，无整页横向溢出和破图');
  assert.deepEqual(errors,[]);checks.push('全部操作无页面脚本错误');
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>{localStorage.removeItem('mw-expert-agents-v1');localStorage.removeItem('mw-agent-layout');});
  for(const [route,name] of [['agents.html','agents'],['squads.html','squads'],['squads.html?id=delivery','squad-detail'],['agents.html?id=mika','agent-detail']]){await visit(route);await page.locator('agent-workspace h1').waitFor();await page.screenshot({path:path.join(root,'previews',name+'-new.png')});}
  const report={passed:true,checks,errors};fs.writeFileSync(path.join(root,'agent-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }catch(error){console.error('Failure context:',await page.locator('agent-workspace').evaluate(e=>({scope:e.scope,query:e.query,status:e.status,agents:e.state.agents.map(a=>({id:a.id,name:a.name,archived:a.archived}))})),errors);throw error;}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
