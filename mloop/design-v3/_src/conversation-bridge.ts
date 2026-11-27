import {BUILTIN_WORK} from './builtin-work';
import {getConversation,saveConversation,conversationUrl} from './collaboration-store';
import type {Conversation} from './collaboration-store';
import {readAgentChats,activeAgents,plainMessage} from './agent-chat-store';
import {groupMessageKeys,readGroupMessages} from './group-message-store';
import {readSquadChatIds,squadChatSource,activateSquadChat} from './squad-chat-store';
import {seedMembers,seedMessages,squadMembers,squadMessages} from './legacy-chat-data';
import {identity} from './local-identity';
import {ownWork} from './member-policy';
import {teamKey,currentTeam} from './team-context';
import {teamGroupNames} from './team-seeds';
function persist(c:Conversation){const existing=getConversation(c.id);if(existing)return existing;saveConversation(c);if(c.draft)sessionStorage.setItem('mw-draft:'+currentTeam().id+':'+identity()+':'+c.id,c.draft);return c}
function migrateAgent(session:any){const agent=activeAgents().find(a=>a.id===session.agentId),who=session.owner||identity(),name=agent?.name||'智能体';return persist({id:'private:'+session.id,title:session.title,members:[who,name],defaultResponders:[name],issues:[],draft:session.draft,updatedAt:session.updated,createdAt:session.messages[0]?.time||session.updated,messages:session.messages.map((m:any,index:number)=>({id:m.id,author:m.role==='assistant'?name:who,text:plainMessage(m.text),time:new Date(m.time).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}),sentAt:Number.isFinite(Date.parse(m.time))?new Date(Date.parse(m.time)+index).toISOString():new Date(index).toISOString(),files:m.files,execution:m.execution}))})}
function group(g:string,squadId?:string){
 const id=squadId?'squad:'+squadId:'group:'+g,existing=getConversation(id);if(existing)return existing;
 const source=squadId?squadChatSource(squadId):null;if(squadId&&!source)return;
 const who=identity(),people=source?squadMembers(source):seedMembers;
 const key=teamKey(squadId?'mw-squad-messages-'+squadId:'mw-group-messages-'+g);
 let messages=readGroupMessages(key);if(!localStorage.getItem(key+':base')){try{messages=JSON.parse(localStorage.getItem(key)||'null')||(source?squadMessages(source,people):seedMessages)}catch{messages=[]}}
 const name=(id:string)=>id==='me'?who:id==='bot'?ownWork(who):people.find(m=>m.id===id)?.name||source?.directory.find(m=>m.id===id)?.name||id;
 return persist({id,title:source?.squad.name||teamGroupNames(['测试群聊','产品评审群','设计走查','研发同步','客户交付沟通'])[Number(g)]||'协作会话',members:[...new Set([who,...people.map(m=>name(m.id))])],defaultResponders:source?.leader?[source.leader.name]:undefined,issues:[],createdAt:messages[0]?messages[0].date+'T'+messages[0].time+':00+08:00':new Date().toISOString(),updatedAt:messages.at(-1)?messages.at(-1).date+'T'+messages.at(-1).time+':00+08:00':new Date().toISOString(),messages:messages.map((m:any,index:number)=>({id:String(m.id),author:name(m.member),text:[m.reply?'引用：'+m.reply:'',m.text,m.reaction].filter(Boolean).join('\n'),time:m.time,sentAt:new Date(Date.parse(m.date+'T'+m.time+':00+08:00')+index).toISOString(),execution:m.execution,files:[...(m.image?[{name:'消息图片',url:m.image}]:[]),...(m.file?[{name:m.file,url:m.fileUrl||'data:text/plain;charset=utf-8,'+encodeURIComponent(m.text||m.file)}]:[])]}))});
}
export function migrateConversations(){for(const s of readAgentChats())migrateAgent(s);for(const id of readSquadChatIds())group('0',id);for(const key of groupMessageKeys()){const squad=key.match(/mw-squad-messages-([^:]+)/)?.[1],g=key.match(/mw-group-messages-([^:]+)/)?.[1];if(squad)group('0',squad);else if(g)group(g)}}
function canonical(c:Conversation|undefined){if(c){history.replaceState(null,'',conversationUrl(c.id));document.title=c.title+' · MobileWork'}return c}
export function resolveGroupConversation(params:URLSearchParams){const squad=params.get('squad')||(currentTeam().id==='brand'?'content':undefined);if(squad)activateSquadChat(squad);return canonical(group(params.get('g')||'0',squad))}
export function resolveAgentConversation(params:URLSearchParams){
 const session=params.get('session');if(session){const s=readAgentChats().find(s=>s.id===session);return canonical(getConversation('private:'+session)||(s?migrateAgent(s):undefined))}
 const agent=activeAgents().find(a=>a.id===params.get('id'))||activeAgents()[0];if(!agent)return;
 const id=crypto.randomUUID(),now=new Date().toISOString();let draft='';try{draft=JSON.parse(localStorage.getItem(teamKey('mw-agent-chat-v1-drafts'))||'{}')[agent.id]||''}catch{}
 const recipient=agent.id===BUILTIN_WORK.id?ownWork():agent.name;
 return canonical(persist({id,title:'与'+agent.name+'的会话',members:[identity(),recipient],defaultResponders:[recipient],messages:[],issues:[],draft,createdAt:now,updatedAt:now}));
}
