// Isolated integration checks; this never touches the browser's saved workspace.
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const app='/Users/xymtop/Desktop/mc/work/apps/app/node_modules';
(async()=>{
 const {Window}=await import('/Users/xymtop/Desktop/mc/work/node_modules/.pnpm/happy-dom@20.11.1/node_modules/happy-dom/lib/index.js');
 const esbuild=require('/Users/xymtop/Desktop/mc/work/node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild');
 const entry=`export * from './collaboration-store';export * from './notifications';export * from './invitation-events';export * from './local-identity';export * from './multica-ui/store';export * from './a2ui-query';export {acceptInvitation} from './invitation-flow';export * from './conversation-lookup';`;
 const {outputFiles}=await esbuild.build({stdin:{contents:entry,resolveDir:__dirname,loader:'ts'},bundle:true,write:false,format:'iife',globalName:'Features',platform:'browser',alias:{react:app+'/react'},define:{'process.env.NODE_ENV':'"production"'}});
 const w=new Window({url:'http://localhost/index.html?team=product'});w.structuredClone=structuredClone;w.eval(outputFiles[0].text);const m=w.Features;
 m.updateWorkspace(s=>{s.members=[{name:'肖叶茂',email:'owner@example.com',role:'所有者'},{name:'受邀成员',email:'join@example.com',role:'成员'}]});
 const c=m.newConversation();m.patchConversation(c.id,{title:'集成验收',project:'验收项目'});
 m.appendConversationMessage(c.id,{id:'background',author:'肖叶茂',text:'项目背景：完成协作升级。',time:'10:00'});
 m.appendConversationMessage(c.id,{id:'decision',author:'肖叶茂',text:'确认采用双模式搜索，待办是检查通知。',time:'10:01'});
 m.appendConversationMessage(c.id,{id:'secret',author:'系统通知',visibleTo:'其他人',text:'PRIVATE_SECRET',time:'10:02'});
 const issue=m.createIssue({title:'交付通知',project:'验收项目',assignee:'受邀成员',status:'待办'});
 m.inviteMembers(c.id,['受邀成员'],m.getWorkspace());
 let conversation=m.getConversation(c.id);const summaries=conversation.messages.filter(n=>n.kind==='onboarding');assert.equal(summaries.length,1);assert.equal(summaries[0].visibleTo,'受邀成员');assert(summaries[0].text.includes('确认采用双模式搜索'));assert(summaries[0].text.includes('交付通知'));assert(!summaries[0].text.includes('PRIVATE_SECRET'));
 assert(!m.collectNotices(m.getWorkspace(),[conversation],'肖叶茂').some(n=>n.text.includes('入群历史摘要')));
 m.setIdentity('受邀成员');const notices=m.collectNotices(m.getWorkspace(),[conversation],'受邀成员');assert(notices.some(n=>n.kind==='invitation'));assert(notices.some(n=>n.text.includes('入群历史摘要')));
 const invite=m.invitationEvents()[0];m.acceptInvitation(invite.id);m.setIdentity('肖叶茂');assert(m.collectNotices(m.getWorkspace(),[conversation],'肖叶茂').some(n=>n.title.includes('已接受邀请')));
 m.inviteMembers(c.id,['受邀成员'],m.getWorkspace());assert.equal(m.getConversation(c.id).messages.filter(n=>n.kind==='onboarding').length,1);
 const spec={kind:'project',subject:'验收项目',days:0};assert.equal(m.queryWorkspace(spec,m.getWorkspace(),{id:'product',name:'验收'}).items[0].status,'待办');m.updateWorkspace(s=>s.issues.find(i=>i.id===issue.id).status='已完成');assert.equal(m.queryWorkspace(spec,m.getWorkspace(),{id:'product',name:'验收'}).items[0].status,'已完成');assert.equal(m.queryWorkspace({...spec,subject:'不存在'},m.getWorkspace(),{id:'product',name:'验收'}).items.length,0);
 assert.equal(m.isConversationLookup('确认周五交付，待办是检查通知。'),false);assert(m.conversationLookup('总结群聊消息',m.getConversation(c.id),m.getWorkspace(),'肖叶茂').includes('确认采用双模式搜索'));m.sendConversationMessage(c.id,'总结群聊消息',[],m.getWorkspace());assert(!m.getConversation(c.id).messages.at(-1).execution);m.sendConversationMessage(c.id,'@Work 总结群聊消息',[],m.getWorkspace());assert(m.getConversation(c.id).messages.at(-1).execution);
 m.appendConversationMessage(c.id,{id:'board-notice',author:'肖叶茂的 Work 助手',text:'',time:'10:03',surface:m.createQuerySurface(spec,m.getWorkspace(),{id:'product',name:'验收'})});assert(m.collectNotices(m.getWorkspace(),[m.getConversation(c.id)],'受邀成员').some(n=>n.text.includes('查询看板已生成')));
 const sourceBefore=m.getConversation(c.id).messages.length;const side=m.ensureSearchConversation(c.id);assert(side.transient);assert.deepEqual(Array.from(side.members),['肖叶茂','肖叶茂的 Work 助手']);m.sendConversationMessage(side.id,'总结关键结论',[],m.getWorkspace());const reply=m.getConversation(side.id).messages.at(-1);assert(reply.execution);assert(reply.execution.demo.context.includes('确认采用双模式搜索'));assert(!reply.execution.demo.context.includes('PRIVATE_SECRET'));assert.equal(m.getConversation(c.id).messages.length,sourceBefore);assert(m.conversationLookup('查找任务',m.getConversation(c.id),m.getWorkspace(),'肖叶茂').includes('交付通知'));
 m.discardTemporaryConversation(side.id);assert(!m.getConversation(side.id));const reopened=m.ensureSearchConversation(c.id);assert.notEqual(reopened.id,side.id);assert.equal(reopened.messages.length,0);m.discardTemporaryConversation(reopened.id);
 m.writeInvitation({id:'email-invite',to:'new@example.com',email:'new@example.com',from:'肖叶茂',context:'团队',time:new Date().toISOString(),href:'work.html',role:'成员'});m.updateWorkspace(s=>s.invitations.push({id:'email-invite',email:'new@example.com',role:'成员'}));assert.throws(()=>m.acceptInvitation('email-invite'));m.setIdentity('new@example.com');m.acceptInvitation('email-invite');assert(m.getWorkspace().members.some(p=>p.email==='new@example.com'));assert(!m.getWorkspace().invitations.some(i=>i.id==='email-invite'));m.acceptInvitation('email-invite');

 const report={groupSummaryWithoutMention:true,naturalLanguageSummaryMatchesHistory:true,realWorkSidebarConversation:true,sidebarSessionDiscarded:true,sourceContextAttached:true,sourceMessageFlowUnchanged:true,teamInviteAcceptance:true,identityMismatchBlocked:true,invitationNotice:true,acceptanceReceipt:true,privateSummary:true,summaryExcludedFromOthersNotices:true,noDuplicateSummary:true,latestQueryData:true,emptyBoardNoSample:true};const reportPath=path.join(__dirname,'../workspace-features-verification.json');const previous=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath,'utf8')):{};fs.writeFileSync(reportPath,JSON.stringify({...previous,...report},null,2)+'\n');console.log(report);await w.happyDOM.close();
})().catch(e=>{console.error(e);process.exitCode=1});
