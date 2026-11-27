import {conversationLookup} from './conversation-lookup';
import {demoRun,progressDemo,demoResult} from './execution-demo';
import {mutateConversations,getConversations} from './collaboration-store';
import {getWorkspace,updateWorkspace} from './multica-ui/store';
import {isAgent,ownWork,parseMentions} from './member-policy';
import {currentTeam} from './team-context';

// Every generated reply has a stable source ID. A shared lock makes one page
// advance the simulation; other pages display the same persisted steps.
let scheduled=false,processing=false;
function advance(){
 const data=getWorkspace();
 const conversations=getConversations();
 if(conversations.some(c=>c.messages.some(m=>m.execution&&(m.execution.status==='waiting'||m.execution.demo&&m.execution.status==='running'))))mutateConversations(all=>{
  for(const c of all)for(const [index,m] of c.messages.entries()){
   if(!m.execution||!['waiting','running'].includes(m.execution.status))continue;
   if(m.execution.status==='waiting'&&!m.execution.demo){const source=c.messages.slice(0,index).reverse().find(m=>m.kind!=='system'&&!m.execution);m.execution=demoRun(source?.text||'整理当前讨论',c.title,c.messages.slice(0,index).filter(m=>m.kind!=='system'&&m.text).slice(-6).map(m=>m.author+'：'+m.text).join('\n'),c.members.filter(n=>!isAgent(n,data)),source?.files?.map(f=>f.name));}
   if(!m.execution.demo)continue;
   m.execution=progressDemo(m.execution);
   if(m.execution.status==='completed'){
    const source=c.sourceConversationId?all.find(s=>s.id===c.sourceConversationId):{...c,messages:c.messages.slice(0,index-1)};const requester=c.searchOwner||c.messages.slice(0,index).reverse().find(message=>message.author!==m.author&&message.kind!=='system'&&message.kind!=='onboarding')?.author;const lookup=source&&requester&&!c.contextIssueId?conversationLookup(m.execution.demo.prompt,source,data,requester):undefined;
    const result=lookup!==undefined?{text:lookup}:demoResult(m.execution.demo);m.text=result.text;
    if(result.document)m.files=[result.document];
    if(result.proposals&&!c.transient)m.proposals=result.proposals.map(p=>({...p,project:c.project||data.issues.find(i=>c.issues.includes(i.id))?.project||''}));
    c.updatedAt=new Date().toISOString();
   }
  }
 });

 const agentsFor=(comment:any)=>{
  const text=comment.text.replace(/<[^>]*>/g,' '),names=[ownWork(comment.author),...data.agents.map(a=>a.name)];
  const invoked=parseMentions(text,names);if(/@(?:work|MobileWork)\b/i.test(text)&&!invoked.some(n=>/^(?:work|MobileWork)\b/i.test(n)))invoked.push(ownWork(comment.author));
  return [...new Set(invoked)];
 };
 const pending=data.comments.some(c=>!c.execution&&!(c as any).demoHandled&&agentsFor(c).length)||data.comments.some(c=>c.execution?.demo&&c.execution.status==='running');
 if(pending)updateWorkspace(workspace=>{
  for(const source of [...workspace.comments]){
   const issue=workspace.issues.find(i=>i.id===source.issue);if(!issue||issue.archived)continue;
   if(!source.execution&&!(source as any).demoHandled){
    const agents=agentsFor(source);if(!agents.length)continue;
    (source as any).demoHandled=true;
    for(const author of agents){
     const id='demo-comment:'+source.id+':'+author;if(workspace.comments.some(c=>c.id===id))continue;
     workspace.comments.push({id,issue:issue.id,author,text:'',replyTo:source.id,createdAt:new Date().toISOString(),execution:demoRun(source.text,issue.title,[issue.description,...workspace.comments.filter(c=>c.issue===issue.id&&!c.execution).slice(-5).map(c=>c.author+'：'+c.text)].filter(Boolean).join('\n'),[...new Set([source.author,issue.assignee])].filter(n=>n&&n!=='无负责人'),source.attachments?.map(f=>f.name))});
    }
   }
  }
  for(const comment of workspace.comments){
   if(!comment.execution?.demo||comment.execution.status!=='running')continue;
   comment.execution=progressDemo(comment.execution);
   if(comment.execution.status==='completed'){
    const result=demoResult(comment.execution.demo);comment.text=result.text;
    if(result.document)comment.attachments=[{...result.document,type:'text/markdown'}];
   }
  }
 });


}
function tick(){
 if(processing)return;processing=true;const team=currentTeam().id;
 const execute=()=>{if(currentTeam().id===team)advance()};
 const work=navigator.locks?navigator.locks.request('mw-demo-execution:'+team,{ifAvailable:true},lock=>{if(lock)execute()}):Promise.resolve().then(execute);
 work.catch(error=>console.error('演示执行保存失败',error)).finally(()=>{processing=false});
}
function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;tick()},60)}
window.addEventListener('mw-local-change',schedule);
window.addEventListener('mw-agent-chats-change',schedule);
window.addEventListener('mw-team-change',schedule);
window.addEventListener('storage',schedule);
window.addEventListener('focus',schedule);
setInterval(tick,350);schedule();
