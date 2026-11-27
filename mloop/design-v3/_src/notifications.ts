import {invitationEvents,matchesInvite} from './invitation-events';
import type {AgentSession} from './agent-chat-store';
import {useSyncExternalStore} from 'react';
import type {Workspace} from './multica-ui/store';
import type {Conversation} from './collaboration-store';
import {teamKey,teamUrl} from './team-context';
import {identity} from './local-identity';
import {parseMentions} from './member-policy';

export type Notice={id:string;source:string;kind:'message'|'mention'|'reply'|'task'|'assignment'|'invitation';inviteId?:string;title:string;text:string;context:string;author:string;time:string;href:string;read:boolean};
const prefix=()=>teamKey('mw-notification-read-v1')+':'+encodeURIComponent(identity())+':';
let version=0;
const listeners=new Set<()=>void>();
function refresh(){version++;listeners.forEach(fn=>fn())}
window.addEventListener('storage',e=>{if(!e.key||e.key.startsWith('mw-notification-read-v1')||e.key.startsWith('mw-invitation-event-v1'))refresh()});
window.addEventListener('mw-identity',refresh);
window.addEventListener('mw-invitations',refresh);
window.addEventListener('mw-team-change',refresh);
window.addEventListener('focus',refresh);
export function useReadVersion(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>version)}
export function markNoticesRead(ids:string[]){
 let changed=false;
 for(const id of ids){const key=prefix()+id;if(!localStorage.getItem(key)){localStorage.setItem(key,new Date().toISOString());changed=true}}
 if(changed)refresh();
}
export const noticeAnchor=(id:string)=>'notice-'+encodeURIComponent(id).replace(/%/g,'_');
const me=(name:string,who:string)=>name===who||(who==='肖叶茂'&&name==='xym')||name.replace(/的\s*Work\s*助手$/i,'')===who;
const plain=(text:string)=>text.replace(/<[^>]*>/g,' ').replace(/[#*_`]/g,'').replace(/\s+/g,' ').trim();

export function collectNotices(data:Workspace,conversations:Conversation[],who:string,chats:AgentSession[]=[],agentNames:Record<string,string>={}):Notice[]{
 conversations=conversations.filter(c=>!c.transient);
 const result:Notice[]=[];
 const add=(n:Omit<Notice,'read'>)=>result.push({...n,read:!!localStorage.getItem(prefix()+n.id)});
 const mention=(text:string)=>parseMentions(plain(text),[who]).includes(who);
 const assigned=(name:string)=>me(name,who)||data.squads.some(s=>s.name===name&&s.members.some(n=>me(n,who)));
 for(const inv of invitationEvents()){
  if(inv.conversation&&!conversations.some(c=>c.id===inv.conversation&&c.members.includes(inv.to)))continue;
  if(inv.email&&!inv.acceptedAt&&!data.invitations.some(i=>i.id===inv.id))continue;
  if(matchesInvite(inv.to,who,data.members)&&!inv.acceptedAt)add({id:'invite:'+inv.id,inviteId:inv.id,source:'invitation',kind:'invitation',title:inv.from+' 邀请你加入',text:inv.context,context:'协作邀请',author:inv.from,time:inv.time,href:inv.href});
  if(inv.from===who&&inv.acceptedAt)add({id:'accepted:'+inv.id,source:'invitation',kind:'invitation',title:inv.to+' 已接受邀请',text:'已加入「'+inv.context+'」',context:'邀请确认',author:inv.to,time:inv.acceptedAt,href:inv.conversation?inv.href:teamUrl('index.html?workspace-settings=members')});
 }
 for(const c of conversations.filter(c=>c.members.includes(who))){
  for(const m of c.messages){
   if(m.visibleTo&&m.visibleTo!==who)continue;
   if(m.author===who||m.kind==='system'||m.execution?.status==='waiting'||m.execution?.status==='running')continue;
   if(!m.text&&!m.files?.length&&!m.execution&&!m.surface&&!m.entry)continue;
   const id='message:'+c.id+':'+m.id,tag=mention(m.text)?'mention':'message';
   add({id,source:'conversation:'+c.id,kind:tag,author:m.author,title:m.execution?.status==='failed'?m.author+' 执行失败':m.execution?.status==='completed'?m.author+' 已完成工作':m.author+(tag==='mention'?' 提到了你':' 发来新消息'),text:plain(m.text)||m.files?.map(f=>f.name).join('、')||(m.surface?m.surface.result.spec.subject+' · 查询看板已生成':m.entry?'已生成操作卡片':'点击查看执行记录'),context:c.title,time:m.sentAt||c.createdAt||'',href:teamUrl('index.html?conversation='+encodeURIComponent(c.id)+'#'+noticeAnchor(id))});
  }
 }
 for(const chat of chats.filter(c=>(c.owner||'肖叶茂')===who))for(const message of chat.messages){
  if(message.role!=='assistant'||!message.execution?.demo||message.execution.status!=='completed')continue;
  const id='agent-message:'+chat.id+':'+message.id,author=agentNames[chat.agentId]||'智能体';
  add({id,source:'agent:'+chat.id,kind:'reply',author,title:author+' 回复了你',text:plain(message.text),context:chat.title,time:message.time,href:teamUrl('agents.html?'+new URLSearchParams({id:chat.agentId,chat:'1',session:chat.id})+'#'+noticeAnchor(id))});
 }
 for(const issue of data.issues.filter(i=>!i.archived)){
  const source='issue:'+issue.id,i=issue as any;
  const url=(id:string)=>teamUrl('work.html?issue='+issue.id+'#'+noticeAnchor(id));
  if(i.createdAt&&i.createdBy&&i.createdBy!==who&&assigned(issue.assignee)){
   const id='task:'+issue.id;
   add({id,source,kind:'task',author:i.createdBy,title:i.createdBy+' 给你创建了新任务',text:issue.title,context:issue.project||'任务',time:i.createdAt,href:url(id)});
  }
  for(const event of i.activity||[]){
   if(!event.assignee||!assigned(event.assignee)||!event.author||event.author===who)continue;
   const id='assignment:'+issue.id+':'+event.id;
   add({id,source,kind:'assignment',author:event.author,title:event.author+' 将任务指派给你',text:issue.title,context:issue.project||'任务',time:event.time,href:url(id)});
  }
  const related=assigned(issue.assignee)||i.createdBy===who||i.subscribers?.some((n:string)=>me(n,who))||data.comments.some(c=>c.issue===issue.id&&me(c.author,who))||conversations.some(c=>c.issues.includes(issue.id)&&c.members.includes(who));
  for(const c of data.comments.filter(c=>c.issue===issue.id&&c.author!==who)){
   if(c.execution&&c.execution.status!=='completed'&&c.execution.status!=='failed')continue;
   const reply=!!c.replyTo&&data.comments.some(p=>p.id===c.replyTo&&me(p.author,who)),at=mention(c.text);
   if(!related&&!reply&&!at)continue;
   const id='comment:'+c.id;
   add({id,source,kind:at?'mention':reply?'reply':'message',author:c.author,title:c.author+(at?' 在任务中提到了你':reply?' 回复了你的评论':' 评论了任务'),text:plain(c.text)||c.attachments?.map(f=>f.name).join('、')||'查看评论',context:issue.title,time:c.createdAt||'',href:url(id)});
  }
 }
 return result.sort((a,b)=>b.time.localeCompare(a.time)||a.id.localeCompare(b.id));
}

// Only claim transient alerts in the focused page. The durable unread state remains shared.
export function claimNoticeToast(id:string){
 const key=teamKey('mw-notification-toast-v1')+':'+encodeURIComponent(identity())+':'+id;
 if(localStorage.getItem(key))return false;
 localStorage.setItem(key,String(Date.now()));return true;
}
