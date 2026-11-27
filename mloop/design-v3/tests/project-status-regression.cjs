const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(5000);
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 const title='状态回归';const base=(process.env.MLOOP_URL || 'http://127.0.0.1:8086');
 const btn=name=>page.getByRole('button',{name,exact:true});
 const modal=page.getByRole('dialog');
 const top=page.locator('.project-known-tasks > .project-task-list');
 try {
 const link=base+'/work.html?team=product&section=tasks&project='+encodeURIComponent(title);
 await page.addInitScript(name=>{
  const key='mw-multica-workspace-v4'; if(localStorage.getItem(key)) return;
  const tasks=[['准备交付','已完成','肖叶茂'],['未分配任务','待规划','无负责人'],['智能体任务','待办','Work'],['阻塞中','阻塞','肖叶茂'],['已纳入的内部任务','待规划','肖叶茂',1],['未纳入的内部任务','待规划','肖叶茂',1],['已做的内部任务','已完成','肖叶茂',1],['未纳入的普通任务','待办','肖叶茂'],['已记录的任务','待规划','肖叶茂'],['运行中','进行中','肖叶茂']];
  const issues=tasks.map(([title,status,assignee,parentIssueId],n)=>({id:n+1,title,status,assignee,parentIssueId,project:name,subscribed:false,pinned:false,description:'',priority:'无优先级'}));
  const nodes=issues.filter(i=>![6,7,8].includes(i.id)).map(i=>({id:'n'+i.id,title:i.title,description:'',issueId:i.id,assignee:i.assignee,after:[2,5].includes(i.id)?['n1']:[],x:i.id*250,y:80}));
  const blueprint={versions:[{number:1,nodes,starts:[{issueId:9,assignee:'肖叶茂',kind:'member',at:'2026-11-26T00:00:00.000Z'}]}]};
  const project={name,description:'',status:'计划中',lead:'肖叶茂',start:'',due:'',priority:'无优先级',workflow:'Default',resources:[],blueprint};
  localStorage.setItem(key,JSON.stringify({issues,projects:[project]}));
 },title);
 await page.goto(link);
 await page.getByRole('heading',{name:'已知任务 · 8',exact:true}).waitFor();assert.equal(await top.locator('button').count(),8);
 assert.equal(await top.getByRole('button',{name:/未纳入的内部任务/}).count(),0);
 await page.getByText('智能体内部任务 · 3',{exact:true}).click();await page.locator('.project-internal').getByRole('button',{name:/未纳入的内部任务/}).waitFor();
 await btn('查看可推进任务').click();
 for(const [name,reason] of [['未分配任务','尚未设置负责人'],['阻塞中','任务已阻塞'],['已记录的任务','已记录本地推进操作'],['运行中','任务正在推进']]){
   const check=modal.getByRole('checkbox',{name,exact:true}); assert.equal(await check.isDisabled(),true); await check.locator('..').getByText(reason,{exact:true}).waitFor();
 }
 await modal.getByRole('checkbox',{name:'智能体任务',exact:true}).locator('..').getByText('可请求智能体执行',{exact:true}).waitFor();
 assert.equal(await modal.getByRole('checkbox',{name:'未纳入的普通任务',exact:true}).count(),0);
 await page.keyboard.press('Escape');
 await top.getByRole('button',{name:/准备交付/}).click();await btn('查看下游交接').click();
 assert.equal(await modal.getByRole('checkbox').count(),2);assert.equal(await modal.getByRole('checkbox',{name:'未分配任务',exact:true}).isDisabled(),true);assert.equal(await modal.getByRole('checkbox',{name:'已纳入的内部任务',exact:true}).isEnabled(),true);
 await page.keyboard.press('Escape');await btn('返回任务列表').click();await page.getByRole('heading',{name:'全部任务',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: existing V1, internal task fold/count, unassigned, blocked, in progress, recorded, agent, direct successors only and back to all tasks');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
