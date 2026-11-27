import {isConversationTaskRequest,planConversationTask} from './conversation-task';
import {createIssue,getWorkspace,type Issue} from './multica-ui/store';
import {isConversationLookup} from './conversation-lookup';
import {writeInvitation} from './invitation-events';
import {recognizeEntry} from './a2ui-entry-model';
import type {EntrySurface} from './a2ui-entry-model';
import {recordHabit} from './a2ui-habits';
import {demoRun} from './execution-demo';
import {recognizeQuery,createQuerySurface,refineQuery} from './a2ui-query';
import {conversationViews,queryViewId} from './view-history';
import type {QuerySurface} from './a2ui-query';
import type {DemoRequest} from './execution-demo';
import {useSyncExternalStore} from 'react';
import {identity} from './local-identity';
import {currentTeam,teamKey} from './team-context';
import {readJournal,writeJournal,watchJournal} from './local-journal';
import {canInvite,ownWork,isAgent,isSquad,squadParticipants,mentionCandidates,blockedWorkMentions} from './member-policy';
import {readComposerContext,sanitizeComposerRequest} from './composer-policy';
import {composerMentions,composerRequest} from './composer-capabilities';
export type TaskProposal={id:string;title:string;description:string;assignee:string;project:string;issueId?:number};
export type WorkExecution={id:string;status:'running'|'completed'|'waiting'|'failed'|'cancelled';duration?:string;reasoning?:string;example?:boolean;note?:string;demo?:DemoRequest;steps:{id:string;title:string;status:'pending'|'running'|'completed'|'failed';detail?:string;tool?:string;duration?:string}[]};
export type ConversationMessage={id:string;author:string;text:string;time:string;visibleTo?:string;sentAt?:string;surface?:QuerySurface;surfaceHistory?:QuerySurface[];entry?:EntrySurface;execution?:WorkExecution;files?:{name:string;url:string}[];kind?:string;proposals?:TaskProposal[];request?:ReturnType<typeof composerRequest>};
export type TaskLinkEvent={id:string;issue:number;time:string;author:string;action:'linked'|'unlinked'};
export type Conversation={transient?:boolean;sourceConversationId?:string;searchOwner?:string;contextIssueId?:number;defaultResponders?:string[];id:string;title:string;members:string[];messages:ConversationMessage[];issues:number[];taskEvents?:TaskLinkEvent[];project?:string;draft?:string;updatedAt?:string;createdAt?:string};

const key=()=>teamKey('mw-conversation-journal-v2');
function base():Conversation[]{
 const seed=key()+':base';const saved=localStorage.getItem(seed);if(saved)return JSON.parse(saved);
 const prefix=teamKey('mw-live-conversations')+':';let conversations:Conversation[]=[];
 for(const k of Object.keys(localStorage).filter(k=>k.startsWith(prefix+'meta:'))){try{const c=JSON.parse(localStorage.getItem(k)!);c.messages=Object.keys(localStorage).filter(m=>m.startsWith(prefix+'message:'+c.id+':')).map(m=>JSON.parse(localStorage.getItem(m)!));conversations.push(c)}catch{}}
 if(!conversations.length){try{conversations=JSON.parse(localStorage.getItem(teamKey('mw-collaboration-v1'))||'[]')}catch{}}
 // Keep the legacy data intact; migrate it once, then append only changed fields.
 localStorage.setItem(seed,JSON.stringify(conversations));return conversations;
}
let temporary:Conversation[]=[];let temporaryScope='';
function read(){const scope=key()+':'+identity();if(scope!==temporaryScope){temporary.forEach(c=>clearTemporaryDraft(c.id));temporary=[];temporaryScope=scope}return [...readJournal(key(),base),...temporary].map(c=>({...c,messages:[...c.messages].sort((a,b)=>(a.sentAt||'').localeCompare(b.sentAt||''))})).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''))}
let state=read();const listeners=new Set<()=>void>();
function refresh(){state=read();listeners.forEach(f=>f())}
export function mutateConversations(fn:(all:Conversation[])=>void){const before=read(),after=structuredClone(before);fn(after);temporary=after.filter(c=>c.transient);writeJournal(key(),before.filter(c=>!c.transient),after.filter(c=>!c.transient));refresh()}
export function saveConversation(c:Conversation){mutateConversations(all=>{const index=all.findIndex(x=>x.id===c.id);if(index<0)all.push(c);else all[index]=c})}
// Local projects are still keyed by display name. Move live references, not snapshots.
export function reassignConversationProject(previous:string,next:string){
 if(!previous||previous===next)return;
 mutateConversations(all=>{for(const c of all){
  if(c.project===previous)c.project=next;
  for(const m of c.messages)for(const p of m.proposals||[]){if(!p.issueId&&p.project===previous)p.project=next}
 }});
}
export const getConversations=()=>read();
export function getConversation(id:string){return read().find(c=>c.id===id)}
export function patchConversation(id:string,patch:Partial<Conversation>){mutateConversations(all=>{const c=all.find(c=>c.id===id);if(c)Object.assign(c,patch,{updatedAt:new Date().toISOString()})})}
export function inviteMembers(id:string,names:string[],data:any){const c=getConversation(id);if(!c||c.transient)return;const allowed=names.filter(n=>canInvite(n,c.members,data));mutateConversations(all=>{const c=all.find(c=>c.id===id);if(c)c.members=[...new Set([...c.members,...allowed])]});const added=allowed.filter(n=>!c.members.includes(n));for(const name of added.filter(n=>!isAgent(n,data))){
 if(name!==identity())writeInvitation({id:crypto.randomUUID(),to:name,from:identity(),time:new Date().toISOString(),context:c.title,href:conversationUrl(id),conversation:id});
 const history=c.messages.filter(m=>!m.visibleTo&&m.kind!=='system'&&m.text),conclusions=history.filter(m=>/确认|决定|结论|同意|确定|采用/.test(m.text)).slice(-5),tasks=data.issues.filter((i:any)=>!i.archived&&(c.issues.includes(i.id)||c.project&&i.project===c.project)&&!['已完成','已取消'].includes(i.status));
 const clean=(s:string)=>s.replace(/<[^>]*>/g,' ').slice(0,400);
 appendConversationMessage(id,{id:crypto.randomUUID(),author:'系统通知',kind:'onboarding',visibleTo:name,time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}),text:'### 入群历史摘要\n仅你可见 · 根据加入前的可见记录整理\n\n**项目背景**\n'+(c.project||c.title)+'\n'+history.slice(0,2).map(m=>m.author+'：'+clean(m.text)).join('\n')+'\n\n**已形成的关键结论**\n'+(conclusions.length?conclusions.map(m=>'- '+clean(m.text)).join('\n'):'尚未识别明确结论，请与成员确认。')+'\n\n**当前待办**\n'+(tasks.length?tasks.map((i:any)=>'- '+i.title+' · '+i.assignee+' · '+i.status).join('\n'):'暂无关联的未完成任务。')});
 }return added}
export function removeConversationMember(id:string,name:string){mutateConversations(all=>{const c=all.find(c=>c.id===id);if(c)c.members=c.members.filter(n=>n!==name)})}
function taskLinkEvent(issue:number,action:TaskLinkEvent['action']):TaskLinkEvent{return {id:crypto.randomUUID(),issue,time:new Date().toISOString(),author:identity(),action}}
function linkTask(c:Conversation,issue:number){if(c.issues.includes(issue))return;c.issues.push(issue);(c.taskEvents??=[]).push(taskLinkEvent(issue,'linked'))}
export function newConversation(context?:{title?:string;project?:string}){const now=new Date().toISOString();const c:Conversation={id:crypto.randomUUID(),title:context?.title?'讨论：'+context.title:'新会话',project:context?.project||'',members:[identity(),ownWork()],messages:[],issues:[],updatedAt:now,createdAt:now};saveConversation(c);return c}
// Sidechat exists only in memory until its panel closes.
export function ensureSearchConversation(sourceId:string){
 const source=getConversation(sourceId),who=identity();if(!source?.members.includes(who))return;
 const c:Conversation={transient:true,id:crypto.randomUUID(),title:'Work',sourceConversationId:sourceId,searchOwner:who,members:[who,ownWork(who)],defaultResponders:[ownWork(who)],messages:[],issues:[...source.issues],project:source.project,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};saveConversation(c);return c;
}
export function openTaskSidechat(issue:Issue){
 const who=identity(),now=new Date().toISOString();
 const c:Conversation={transient:true,contextIssueId:issue.id,id:crypto.randomUUID(),title:'Work',project:issue.project,members:[who,ownWork(who)],defaultResponders:[ownWork(who)],messages:[],issues:[],createdAt:now,updatedAt:now};saveConversation(c);return c;
}
export function taskSourceId(issue:Issue,conversations:Conversation[]){
 return issue.sourceConversationId||conversations.flatMap(c=>c.transient?[]:c.messages.filter(m=>m.kind==='task-conversion'&&m.text.startsWith('我已根据会话记录整理并创建了任务')&&m.proposals?.some(p=>p.issueId===issue.id)).map(m=>({id:c.id,created:m.sentAt||c.createdAt||''}))).sort((a,b)=>a.created.localeCompare(b.created))[0]?.id;
}
function clearTemporaryDraft(id:string){for(const k of Object.keys(sessionStorage))if(/^(mw-draft|mw-composer-v2):/.test(k)&&k.endsWith(':'+id))sessionStorage.removeItem(k)}
export function discardTemporaryConversation(id:string){temporary=temporary.filter(c=>c.id!==id);clearTemporaryDraft(id);refresh()}
export function useConversations(){return useSyncExternalStore(f=>{listeners.add(f);return()=>listeners.delete(f)},()=>state)}
export function conversationUrl(id:string){return 'index.html?'+new URLSearchParams({conversation:id,team:currentTeam().id})}
export function appendConversationMessage(id:string,message:ConversationMessage){mutateConversations(all=>{const c=all.find(c=>c.id===id);if(c){c.messages.push({...message,sentAt:message.sentAt||new Date().toISOString()});c.updatedAt=new Date().toISOString()}})}
function linkCreatedIssue(id:string,issue:number){mutateConversations(all=>{const c=all.find(c=>c.id===id);if(c&&!c.transient)linkTask(c,issue)})}
export function recordProposalIssue(id:string,messageId:string,proposalId:string,issue:number){if(getWorkspace().issues.find(i=>i.id===issue)?.sourceConversationId!==id)return;mutateConversations(all=>{const c=all.find(c=>c.id===id);if(!c||c.transient)return;linkTask(c,issue);const p=c.messages.find(m=>m.id===messageId)?.proposals?.find(p=>p.id===proposalId);if(p)p.issueId=issue})}
export function updateQuerySurface(conversationId:string,messageId:string,surface:QuerySurface){mutateConversations(all=>{const m=all.find(c=>c.id===conversationId)?.messages.find(m=>m.id===messageId);if(!m)return;const previous=m.surface;if(previous&&previous.id!==surface.id){m.surfaceHistory??=[];if(!m.surfaceHistory.some(s=>s.id===previous.id))m.surfaceHistory.push(previous)}m.surface={...surface,viewId:surface.viewId||previous?.viewId||(previous?queryViewId(previous.result.spec):queryViewId(surface.result.spec))}})}
export function updateWorkExecution(conversationId:string,messageId:string,execution:WorkExecution){mutateConversations(all=>{const m=all.find(c=>c.id===conversationId)?.messages.find(m=>m.id===messageId);if(m)m.execution=execution})}
window.addEventListener('mw-work-execution',(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.conversationId&&d?.messageId&&d?.execution)updateWorkExecution(d.conversationId,d.messageId,d.execution)});
window.addEventListener('mw-identity',refresh);window.addEventListener('mw-team-change',refresh);watchJournal(key,refresh);

export function sendConversationMessage(id:string,text:string,files:any[],data:any,config?:any){
 const c=getConversation(id);if(!c)throw new Error('会话不存在');const who=identity();
 if(!c.members.includes(who))throw new Error('请先加入会话再发送消息');
 const taskConversion=!c.transient&&isConversationTaskRequest(text,who);
 const blocked=(taskConversion||c.transient)?[]:blockedWorkMentions(text,c.members,who);if(blocked.length)throw new Error('请先让 '+blocked.map(n=>n.replace(/的\s*Work\s*助手$/i,'')).join('、')+' 邀请自己的 Work 助手加入会话');
 const mentioned=(taskConversion||c.transient)?[ownWork(who)]:composerMentions(text,mentionCandidates(c.members,data,who),who);
 const squadNames=mentioned.filter(n=>isSquad(n,data));
 const expanded=[...new Set([...mentioned,...squadNames.flatMap(n=>squadParticipants(n,data))])];
 const effectiveMembers=[...new Set([...c.members,...expanded])];
 const composer=readComposerContext(effectiveMembers,who,text,data),request=sanitizeComposerRequest(effectiveMembers,who,text,data,config);
 const added=inviteMembers(id,expanded,data)||[];
 const time=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
 if(added.length)appendConversationMessage(id,{id:crypto.randomUUID(),author:'系统',text:who+' 邀请 '+added.join('、')+' 加入会话',time,kind:'system'});
 appendConversationMessage(id,{id:crypto.randomUUID(),author:who,text,time,files,request});
 if(taskConversion){
  const author=ownWork(who),plan=planConversationTask({messages:c.messages,title:c.title,request:text,who});
  if(!plan){appendConversationMessage(id,{id:crypto.randomUUID(),author,time,kind:'task-conversion',text:'会话里还没有足够的内容可整理成任务。补充一下要推进的事项，再 @Work 就可以帮你创建并关联。'});return}
  const issues=getWorkspace().issues;
  const linked=issues.filter(issue=>taskSourceId(issue,getConversations())===id&&!issue.archived);
  const existing=!files.length?linked.find(issue=>issue.title===plan.title&&issue.description===plan.description):undefined;
  const project=c.project||linked[0]?.project||'';
  const issue=existing||createIssue({...plan,project,status:'待办',sourceConversationId:id},files.length?{id:crypto.randomUUID(),author:who,text:'来自会话的任务附件',createdAt:new Date().toISOString(),attachments:files}:undefined);
  linkCreatedIssue(id,issue.id);
  appendConversationMessage(id,{id:crypto.randomUUID(),author,time,kind:'task-conversion',text:existing?'这项任务已关联到本会话，没有重复创建。':'我已根据会话记录整理并创建了任务，已关联到本会话。',proposals:[{id:crypto.randomUUID(),title:issue.title,description:issue.description,assignee:issue.assignee,project:issue.project,issueId:issue.id}]});
  return;
 }

 const members=getConversation(id)!.members;const source=c.sourceConversationId?getConversation(c.sourceConversationId):undefined;const contextIssue=c.contextIssueId?getWorkspace().issues.find(i=>i.id===c.contextIssueId):undefined;const sourceContext=contextIssue?`当前任务：ANDR-${contextIssue.id} · ${contextIssue.title}\n${contextIssue.description}\n状态：${contextIssue.status} · 负责人：${contextIssue.assignee}`:source?.members.includes(who)?'当前会话：'+source.title+'\n'+source.messages.filter(m=>(!m.visibleTo||m.visibleTo===who)&&m.kind!=='system'&&m.text).map(m=>m.author+'：'+m.text).join('\n'):'';
 const invoked=mentioned.flatMap(n=>isSquad(n,data)?squadParticipants(n,data).filter(p=>isAgent(p,data)):[n]).filter(n=>isAgent(n,data));
 const conversationReview=isConversationLookup(text)&&(/总结|汇总|回顾|结论/.test(text)||!!c.sourceConversationId);
 const executors=invoked.length?[...new Set(invoked)]:composer.kind==='group'?[]:c.defaultResponders?.filter(n=>members.includes(n)).length?c.defaultResponders.filter(n=>members.includes(n)):conversationReview?[members.includes(ownWork(who))?ownWork(who):members.find(n=>isAgent(n,data))||ownWork(who)]:members.filter(n=>!isAgent(n,data)).length===1?[members.find(n=>isAgent(n,data))||ownWork(who)]:[];
 const scopedLookup=conversationReview||!!source?.members.includes(who)&&isConversationLookup(text);
 const entry=(scopedLookup||c.contextIssueId)?undefined:recognizeEntry(text);
 if(entry&&executors.length){const team=currentTeam();recordHabit(entry);appendConversationMessage(id,{id:crypto.randomUUID(),author:executors[0],text:'',time,kind:'a2ui-entry',entry:{id:entry,teamId:team.id,teamName:team.name,createdAt:Date.now()}});if(!c.messages.length&&(c.title==='新会话'||/^与.+的会话$/.test(c.title)))patchConversation(id,{title:text.trim().slice(0,32)});return}
 const views=conversationViews(c,who),contextView=views.find(v=>v.id===config?.viewContext)||(/改为|改成|调整|只看|只显示|这个视图|重新生成/.test(text)?views.at(-1):undefined);
 const query=(scopedLookup||c.contextIssueId)?undefined:contextView?refineQuery(text,contextView.versions.at(-1)!.surface.result.spec,data,who):recognizeQuery(text,data,who);
 if(query&&executors.length){recordHabit(query.kind);const surface={...createQuerySurface(query,data,currentTeam()),viewId:contextView?.id||queryViewId(query),instruction:text};appendConversationMessage(id,{id:crypto.randomUUID(),author:executors[0],text:'',time,kind:'a2ui',surface});if(!c.messages.length&&(c.title==='新会话'||/^与.+的会话$/.test(c.title)))patchConversation(id,{title:text.trim().slice(0,32)||'进展查询'});return}
 for(const author of executors)appendConversationMessage(id,{id:crypto.randomUUID(),author,text:'',time,kind:'execution',execution:demoRun(text,c.title,[sourceContext,...c.messages.filter(m=>(!m.visibleTo||m.visibleTo===who)&&m.kind!=='system'&&m.text).slice(-6).map(m=>m.author+'：'+m.text)].filter(Boolean).join('\n'),members.filter(n=>!isAgent(n,data)),files.map(f=>f.name))});
 if(!c.messages.length&&(c.title==='新会话'||/^与.+的会话$/.test(c.title)))patchConversation(id,{title:text.replace(/@[^@\s]+/g,'').trim().slice(0,32)||'协作会话'});
}
