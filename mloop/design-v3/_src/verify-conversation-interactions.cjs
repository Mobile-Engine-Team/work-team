const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.MLOOP_URL||'http://127.0.0.1:8086';

(async()=>{
 const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   const key='mw-conversation-journal-v2:base';
   if(localStorage.getItem(key))return;
   const now=new Date().toISOString();
   const message=(id,author,text,extra)=>({id,author,text,time:'09:30',...extra});
   localStorage.setItem(key,JSON.stringify([
    {id:'verify-group',title:'上传重试讨论',members:['肖叶茂','赵一帆'],messages:[message('source','赵一帆','复现后需要修复上传失败后的重试状态。'),message('private','系统通知','不要外传的验收记录',{visibleTo:'肖叶茂',kind:'onboarding'})],issues:[],updatedAt:now},
    {id:'verify-work',title:'与 Work 对话',members:['肖叶茂','肖叶茂的 Work 助手'],messages:[],issues:[],updatedAt:now},
    {id:'verify-empty',title:'简单问候',members:['肖叶茂','赵一帆'],messages:[message('hello','赵一帆','你好')],issues:[],updatedAt:now}
   ]));
  });
  const index=async params=>{await page.goto(base+'/index.html?team=product&'+params);await page.getByRole('textbox',{name:'会话消息'}).waitFor()};
  const composer=page.getByRole('textbox',{name:'会话消息'});
  const send=page.getByRole('button',{name:'发送消息',exact:true});
  const notes=page.getByRole('button',{name:'填入建议',exact:true});
  await index('start=chat');
  assert.equal(await composer.inputValue(),'');
  assert(await send.isDisabled());
  await composer.press('Enter');
  assert(new URL(page.url()).searchParams.has('start'));
  const hint=await composer.getAttribute('placeholder');
  assert(hint.startsWith('可以试试：'));
  await notes.click();
  assert.equal(await composer.inputValue(),hint.slice('可以试试：'.length));
  assert(await composer.evaluate(el=>document.activeElement===el));
  assert(new URL(page.url()).searchParams.has('start'));
  await composer.fill('我可以直接修改建议');
  assert.equal(await composer.inputValue(),'我可以直接修改建议');
  assert.equal(await page.getByRole('region',{name:'最近会话'}).getByLabel('新建会话').count(),0);
  await page.getByRole('link',{name:'协作空间',exact:true}).click();
  await page.waitForURL('**/space.html?team=product');
  assert.equal(await page.getByRole('link',{name:'协作空间',exact:true}).locator('svg').count(),1);

  await index('conversation=verify-group');
  await composer.fill('优先修复失败后的重试状态');
  await page.getByRole('button',{name:'转为任务',exact:true}).click();
  const draft=await composer.inputValue();
  assert(draft.startsWith('@Work ')&&draft.endsWith('优先修复失败后的重试状态'));
  assert(await composer.evaluate(el=>document.activeElement===el));
  assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(await page.locator('.co-message.co-mine').count(),0);
  await send.click();
  const linked=page.getByRole('link',{name:'查看任务',exact:true});
  await linked.waitFor();
  assert.equal(new URL(page.url()).searchParams.get('conversation'),'verify-group');
  assert(await page.locator('.co-messages').getByText('我已根据会话记录整理并创建了任务，已关联到本会话。').isVisible());
  const taskUrl=await linked.getAttribute('href');
  await composer.fill(draft);
  await send.click();
  await page.locator('.co-messages').getByText('这项任务已关联到本会话，没有重复创建。').waitFor();
  assert.deepEqual(await linked.evaluateAll(links=>links.map(l=>l.getAttribute('href'))),[taskUrl,taskUrl]);
  await page.reload();await linked.first().waitFor();
  await linked.first().click();
  await page.getByText('复现后需要修复上传失败后的重试状态。',{exact:false}).first().waitFor();
  assert.equal(await page.getByText('不要外传的验收记录',{exact:false}).count(),0);

  await index('conversation=verify-empty');
  await composer.fill('@肖叶茂的 Work 助手 请根据会话记录创建并关联任务。');
  await send.click();
  await page.locator('.co-messages').getByText('会话里还没有足够的内容可整理成任务。',{exact:false}).waitFor();
  assert.equal(await page.getByRole('link',{name:'查看任务',exact:true}).count(),0);

  await index('conversation=verify-work');
  assert.equal(await notes.count(),0);
  assert.equal(await composer.inputValue(),'');
  assert(!(await composer.getAttribute('placeholder')).startsWith('可以试试：'));
  assert(await send.isDisabled());
  await composer.fill('查询 肖叶茂 最近 7 天的进展');
  await send.click();
  const preview=page.locator('.view-preview');await preview.waitFor();
  const left=page.locator('.design-sidebar'),width=el=>el.evaluate(e=>Math.round(e.getBoundingClientRect().width));
  async function drag(name,delta){const handle=page.getByRole('separator',{name}),r=await handle.boundingBox();assert(r);await page.mouse.move(r.x+r.width/2,r.y+90);await page.mouse.down();await page.mouse.move(r.x+r.width/2+delta,r.y+90,{steps:6});await page.mouse.up()}
  const leftBefore=await width(left),rightBefore=await width(preview);
  await drag('调整左侧栏宽度',64);
  assert.equal(await width(left),leftBefore+64);
  const rightAfterLeft=await width(preview);assert(rightAfterLeft<=rightBefore);
  await drag('调整视图预览宽度',80);
  assert.equal(await width(preview),rightAfterLeft-80);
  const rightSplitter=page.getByRole('separator',{name:'调整视图预览宽度'});
  await rightSplitter.press('ArrowLeft');
  assert.equal(await width(preview),rightAfterLeft-68);
  await page.reload();await preview.waitFor();
  assert.equal(await width(left),leftBefore+64);
  assert.equal(await width(preview),rightAfterLeft-68);
  assert.equal(await preview.getByRole('button',{name:'收起视图侧栏'}).count(),0);
  const close=page.getByRole('button',{name:'收起视图侧栏'});
  for(const viewport of [{width:1440,height:900},{width:1024,height:768},{width:430,height:820}]){
   await page.setViewportSize(viewport);
   await close.click();await preview.waitFor({state:'hidden'});
   await page.getByRole('button',{name:'展开视图侧栏'}).click();await preview.waitFor();
  }
  assert.equal(await rightSplitter.isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('Verified: editable optional suggestions, simple navigation, in-chat Work task creation and linking, no duplicate/private data, both resizers, preview toggling at desktop and mobile widths');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
