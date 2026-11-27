// Real UI only: each run gets a fresh browser profile and a sample created from the team menu.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.MLOOP_URL||'http://127.0.0.1:8086';
const b=(p,name)=>p.getByRole('button',{name,exact:typeof name==='string'});
const menu=(p,name)=>p.getByRole('menuitem',{name,exact:true});
const h=(p,name)=>p.getByRole('heading',{name,exact:true});
const txt=(p,value)=>p.getByText(value,{exact:typeof value==='string'});
const act=(p,n,id)=>p.locator(`[data-action="${n}"]${id?`[data-id="${id}"]`:''}`);
const dialog=(p,name)=>p.getByRole('dialog',{name,exact:true});
const edit=(p,name)=>p.getByRole('textbox',{name,exact:true});
const pass=s=>console.log('PASS '+s);
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(7000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/index.html?team=product');await b(page,/^切换团队：/).click();await b(page,/^新建演示工作区/).click();await h(page,'全部项目').waitFor();
  const q=new URLSearchParams({team:new URL(page.url()).searchParams.get('team')});
  const url=(path,params={})=>base+'/'+path+'?'+new URLSearchParams([...q,...Object.entries(params)]);
  const go=(path,params)=>page.goto(url(path,params));
  const switchUser=async name=>{await b(page,'账户菜单').click();await b(page,'切换当前用户').click();await b(dialog(page,'切换当前用户'),name).click()};
  try{
   await go('work.html',{issue:'104'});
   await b(page,'发送评论').waitFor();assert(await b(page,'发送评论').isDisabled());
   await edit(page,'任务评论').fill('需要实跑交付清单');await b(page,'发送评论').click();
   const own=page.locator('.wb-comment').filter({hasText:'需要实跑交付清单'});
   await b(own,/评论操作/).click();await menu(page,'编辑评论').click();await edit(own,'编辑评论').fill('需要实跑新版交付清单');await b(page.locator('.wb-comment-edit-actions'),'保存').click();
   const updated=page.locator('.wb-comment').filter({hasText:'需要实跑新版交付清单'});
   await b(updated,'点赞评论').click();assert.match(await b(updated,'点赞评论').getAttribute('class'),/is-active/);
   await switchUser(/member1@demo.invalid/);await b(updated,/评论操作/).click();await menu(page,'复制文本').waitFor();assert.equal(await menu(page,'编辑评论').count(),0);assert.equal(await menu(page,'删除评论').count(),0);await page.keyboard.press('Escape');
   await b(updated,'回复').click();await edit(page,'任务评论').fill('验收回复保留');await b(page,'发送评论').click();await page.locator('.wb-comment-reply-context').filter({hasText:'需要实跑新版交付清单'}).waitFor();
   await switchUser(/肖叶茂/);await b(updated.filter({hasNot:page.locator('.wb-comment-reply-context')}),/评论操作/).click();await menu(page,'删除评论').click();await b(page,'删除评论').click();
   await txt(page,'验收回复保留').waitFor();assert.equal(await page.locator('.wb-comment-reply-context').count(),0);
   await b(page,'添加任务链接').click();let box=dialog(page,'关联链接');await box.getByLabel('链接地址').fill('javascript:bad');await b(box,'保存').click();await box.getByRole('alert').waitFor();await box.getByLabel('链接地址').fill('https://example.invalid/acceptance');await box.getByLabel('链接名称').fill('验收规范');await b(box,'保存').click();
   await txt(page,'唤醒与提醒').click();await b(page,'添加唤醒').click();box=dialog(page,'添加唤醒');await box.getByLabel('唤醒时间').fill('2000-01-01T12:00');await b(box,'保存').click();await box.getByRole('alert').waitFor();
   const future=new Date(Date.now()+86400000);const local=new Date(+future-future.getTimezoneOffset()*60000).toISOString().slice(0,16);
   await box.getByLabel('唤醒时间').fill(local);await box.getByLabel('唤醒提醒内容').fill('复查交付');await b(box,'保存').click();await txt(page,'复查交付').waitFor();
   await b(page,/^唤醒操作 /).click();await menu(page,'暂停唤醒').click();await txt(page,'已暂停').waitFor();await b(page,/^唤醒操作 /).click();await menu(page,'恢复唤醒').click();await txt(page,'复查交付').waitFor();
   await page.reload();await txt(page,'验收回复保留').waitFor();assert.equal(await page.getByRole('link',{name:'验收规范'}).getAttribute('href'),'https://example.invalid/acceptance');await b(page,'移除链接 验收规范').click();await b(dialog(page,'移除任务链接'),'移除链接').click();await page.getByRole('link',{name:'验收规范'}).waitFor({state:'hidden'});
   await txt(page,'唤醒与提醒').click();await b(page,/^唤醒操作 /).click();await menu(page,'删除唤醒').click();await txt(page,'复查交付').waitFor({state:'hidden'});
   await txt(page,'执行日志').first().click();await b(page,'运行智能体').click();box=dialog(page,'执行详情');await txt(box,'待运行').waitFor();await b(box,'关闭').last().click();await b(page,/手动运行.*待运行/).click();await dialog(page,'执行详情').waitFor();
   await go('work.html',{issue:'102'});await txt(page,'执行日志').first().click();assert(await b(page,'运行智能体').isDisabled());
   pass('任务评论权限、编辑、点赞、回复不级联删除、链接校验、唤醒增停启删、智能体运行回执及真人拦截');

   await go('index.html');await b(page,'搜索会话与任务').click();const search=dialog(page,'全局搜索');await search.getByLabel('全局搜索关键词').fill('不存在的验收关键字xyz');assert.equal(await search.locator('a').count(),0);await search.getByLabel('全局搜索关键词').fill('实现上传重试去重');await search.getByRole('link',{name:/实现上传重试去重/}).first().click();await page.waitForURL(/issue=102/);
   await go('index.html');await b(page,'搜索会话与任务').click();await search.getByLabel('全局搜索关键词').fill('灰度');await search.getByRole('link',{name:/灰度发布私下确认/}).first().waitFor();await page.keyboard.press('Escape');
   await b(page,/^通知(?:，|$)/).click();const notifications=dialog(page,'通知中心');await b(notifications,/^标为已读：/).first().click();if(await b(notifications,'全部已读').isEnabled())await b(notifications,'全部已读').click();await h(notifications,'暂时没有未读通知').waitFor();
   await page.reload();await b(page,'通知').click();await h(notifications,'暂时没有未读通知').waitFor();await notifications.getByRole('tab',{name:'全部'}).click();assert((await notifications.locator('article').count())>0);await b(notifications,'关闭通知').click();
   await switchUser(/member2@demo.invalid/);await b(page,'搜索会话与任务').click();await search.getByLabel('全局搜索关键词').fill('灰度发布私下确认');assert.equal(await search.getByRole('link',{name:/灰度发布私下确认/}).count(),0);await page.keyboard.press('Escape');await switchUser(/肖叶茂/);
   pass('全局搜索任务定位、私聊排除、通知单条与全部已读及持久化');

   await page.clock.install();await go('index.html');const suggestion=page.getByRole('complementary',{name:'Work 主动建议'});await page.clock.fastForward(18500);await suggestion.waitFor();
   await b(suggestion,'为什么想到这件事').click();assert((await suggestion.locator('li').count())>0);await b(suggestion,'一小时后再说').click();await suggestion.waitFor({state:'hidden'});
   await page.clock.fastForward(1800000);await suggestion.waitFor({state:'hidden'});await page.clock.fastForward(1815000);await b(suggestion,'一起看一下').click();await b(page,/固定看板/).first().click();
   const source=page.url();const pin=page.locator('a[href*="board="]').first();await pin.click();const pinned=page.url();
   await txt(page,/当前最新版 · v1/).waitFor();await b(page,'刷新数据并保存新版本').click();await txt(page,/当前最新版 · v2/).waitFor();await page.reload();await txt(page,/当前最新版 · v2/).waitFor();
   await b(page,'取消固定').click();await page.waitForURL(u=>u.pathname==='/index.html');await page.goto(pinned);await h(page,'这个视图已取消固定').waitFor();await page.goto(source);await b(page,/固定看板/).first().waitFor();
   pass('主动建议原因、延后、跳转查询、固定视图新版本、刷新保持、取消固定保留源会话');

   await go('agents.html');await page.getByLabel('搜索智能体').fill('不存在的智能体xyz');await h(page,'没有找到匹配结果').waitFor();await b(page,'清除筛选').click();await page.getByLabel('状态筛选').selectOption('离线');await act(page,'open','demo-qa').first().click();
   const agent=page.url();await act(page,'quick-description').click();await page.locator('form[data-form="quick-identity"] [name=value]').fill('可复测的质量助手');await b(dialog(page,'编辑描述'),'保存').click();await txt(page,'可复测的质量助手').waitFor();
   await b(page,'编辑访问权限').click();const config=page.getByRole('dialog',{name:/^设置/});await config.locator('[name="access"][value="指定成员"]').check();await b(config,'保存').click();await txt(config,'请选择至少一位成员').waitFor();await config.locator('[name=allowed]').first().check();await b(config,'保存').click();await act(page,'settings-close').click();await page.reload();await txt(page,'指定成员').waitFor();
   await b(page,'更多操作').click();await menu(page,'归档智能体').click();await b(dialog(page,'归档智能体'),'确认归档').click();await go('agents.html');await b(page,'已归档').click();await act(page,'open','demo-qa').first().click();await b(page,'更多操作').click();await menu(page,'恢复智能体').click();await page.goto(agent);await b(page,'对话').waitFor();
   pass('智能体搜索、筛选、编辑、指定成员校验、归档与恢复');

   await go('squads.html');await act(page,'open','demo-squad').first().click();await act(page,'quick-description').click();await page.locator('form[data-form="quick-identity"] [name=value]').fill('本地验收团队');await b(dialog(page,'编辑描述'),'保存').click();
   const member=page.locator('.aw-member-row').filter({hasText:'杨陈皓'});await member.locator('button').last().click();await menu(page,'编辑角色分工').click();const role=dialog(page,'编辑角色分工');await role.locator('[name=role]').fill('验收负责人');await role.locator('button[type=submit]').click();
   await page.reload();await txt(page,'本地验收团队').waitFor();await txt(member,/验收负责人/).waitFor();await b(page,'更多操作').click();await menu(page,'归档小队').click();await b(dialog(page,'归档小队'),'确认归档').click();await go('squads.html');assert.equal(await act(page,'open','demo-squad').count(),0);
   assert.deepEqual(errors,[]);pass('小队描述与成员角色持久化、不可恢复归档');
  }catch(error){console.error(page.url(),errors,(await page.locator('body').innerText()).slice(-3300));throw error}
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
