import type {WorkExecution} from './collaboration-store';
import {teamKey,currentTeam} from './team-context';
import {useSyncExternalStore} from 'react';
import {readExpertWorkspace} from './agent-workspace';
export const CHAT_KEY='mw-agent-chat-v1';
let cachedTeam='';
export type ChatFile={name:string;url:string;type:string;size?:number};
export type ChatMessage={id:string;text:string;time:string;role?:'user'|'assistant';files?:ChatFile[];example?:boolean;execution?:WorkExecution};
export type AgentSession={owner?:string;id:string;agentId:string;title:string;updated:string;messages:ChatMessage[];draft?:string;example?:boolean;previewInitialized?:boolean};
let cachedRaw:string|null|undefined,cached:AgentSession[]=[],previewIds:Set<string>|undefined;
export function activeAgents(){return readExpertWorkspace().agents.filter(a=>!a.archived)}
export function plainMessage(text:string){if(!/<\/?(?:p|div|br|span|ul|li|strong|em|h[1-6])\b/i.test(text))return text;const doc=new DOMParser().parseFromString(text,'text/html');doc.querySelectorAll('br').forEach(b=>b.replaceWith('\n'));doc.querySelectorAll('p,div,li').forEach(e=>e.append('\n'));return doc.body.textContent?.trim()||''}
// Keep existing messages and add sample replies to conversations that had no
// assistant messages when this preview loaded. Newly created chats stay empty.
function previewLegacyChat(session:AgentSession):AgentSession{
 if(!previewIds?.has(session.id)||!session.messages.length||session.messages.some(m=>m.role==='assistant'))return session;
 const messages=session.messages.flatMap((m,index)=>{
  const text=plainMessage(m.text||'');
  const repeated=index>0&&session.messages.slice(0,index).some(previous=>plainMessage(previous.text||'')===text);
  const reply=repeated?'比如，我们可以先整理一份本周项目进展：\n\n1. 汇总已经完成的工作\n2. 标记进行中的事项与风险\n3. 明确下一步安排\n\n把任务清单或会议纪要发给我，就可以开始。':/你好|hello|hi\b/i.test(text)?'你好 👋 我可以和你一起梳理需求、整理资料和制定工作计划。\n\n你想先聊哪个主题？':/能干|做什么|擅长/.test(text)?'我可以协助你完成这些工作：\n\n• 梳理需求与讨论方案\n• 整理会议纪要、周报和项目资料\n• 拆解工作步骤，明确交付与验收标准\n\n你也可以直接发来文字、图片或文件，我们围绕当前主题继续讨论。':'可以，我们先把目标、现状和需要交付的结果整理清楚。\n\n我会帮你提炼重点，再按优先级拆成可以推进的步骤。你可以继续补充相关资料。';
  return [{...m,role:'user' as const},{id:'preview-'+session.id+'-'+index,role:'assistant' as const,text:reply,time:m.time,example:true}];
 });
 return {...session,messages,example:true,previewInitialized:true};
}
function examples():AgentSession[]{if(!['product','brand'].includes(currentTeam().id))return [];if(currentTeam().id==='brand'){const agent=activeAgents()[0];return agent?[{id:'brand-plan',agentId:agent.id,title:'讨论双十一内容方向',updated:'2026-11-10T10:00:00+08:00',example:true,previewInitialized:true,messages:[{id:'brand-msg-1',role:'user',text:'这次双十一专题，我想更突出用户的真实使用场景。',time:'2026-11-10T09:58:00+08:00'},{id:'brand-msg-2',role:'assistant',text:'可以围绕「工作日的效率时刻」展开，选择三个高频场景，分别对应一篇长图文和一组社媒短内容。\n\n我先整理选题方向和素材清单，提交给品牌内容小队一起评审。',time:'2026-11-10T10:00:00+08:00'}]}]:[];}const agents=activeAgents(),first=agents[0],second=agents[1];if(!first)return[];const message=(id:string,role:'user'|'assistant',text:string,time:string):ChatMessage=>({id,role,text,time:'2026-11-09T'+time+':00+08:00',example:true});return [
{id:'example-weekly',agentId:first.id,title:'梳理本周项目进展',updated:'2026-11-09T10:36:00+08:00',example:true,messages:[message('weekly-1','user','帮我梳理一下本周的项目进展，整理成一份简洁的周报。','10:24'),message('weekly-2','assistant','可以，我们按「已完成、进行中、待确认」三个部分整理。\n\n你可以把本周的会议纪要、任务清单或项目资料发给我，我会提取进展、负责人和需要关注的风险。','10:25'),message('weekly-3','user','这周主要在打磨 Work 的群聊和智能体私聊体验，群聊页面已经完成，私聊在做设计。','10:28'),message('weekly-4','assistant','本周项目进展\n\n已完成\n• 群聊消息展示、图片与文件发送\n• 群信息、成员管理与记录搜索\n\n进行中\n• 智能体私聊页面设计\n• 同一智能体的多个会话管理\n\n待确认\n• 私聊入口与任务区域的衔接\n• 会话标题、历史切换和草稿保留','10:29'),message('weekly-5','user','可以，私聊会话放在任务区域，标题按讨论主题来，和其他对话保持一致。','10:35'),message('weekly-6','assistant','好的。每个讨论主题保留独立的会话和消息记录；同一个智能体可以开启多个会话。\n\n我也会把这一项补充到本周的设计验收清单中。','10:36')]},
{id:'example-plan',agentId:first.id,title:'整理产品评审准备事项',updated:'2026-11-08T16:20:00+08:00',example:true,messages:[{id:'plan-1',role:'user',text:'下次产品评审需要准备哪些资料？',time:'2026-11-08T16:18:00+08:00',example:true},{id:'plan-2',role:'assistant',text:'建议准备三类资料：\n\n1. 需求说明：问题、目标用户和本轮范围。\n2. 交互原型：核心流程、空状态和异常情况。\n3. 验收清单：逐项写明预期行为和负责人。\n\n我们可以在这个会话里继续完善评审材料，与周报讨论分开记录。',time:'2026-11-08T16:20:00+08:00',example:true}]},
...(second?[{id:'example-demand',agentId:second.id,title:'拆解群聊功能验收标准',updated:'2026-11-08T14:00:00+08:00',example:true,messages:[{id:'demand-1',role:'assistant' as const,text:'我们可以从消息类型、成员权限、历史搜索和边界状态四个方面整理验收标准。你希望先讨论哪一部分？',time:'2026-11-08T14:00:00+08:00',example:true}]}]:[])]}
export function readAgentChats():AgentSession[]{if(cachedTeam!==currentTeam().id){cachedRaw=undefined;previewIds=undefined;cachedTeam=currentTeam().id;}let raw:null|string=null;try{raw=localStorage.getItem(teamKey(CHAT_KEY))}catch{}if(cachedRaw===raw)return cached;cachedRaw=raw;try{const parsed=raw===null?examples():JSON.parse(raw);previewIds??=new Set(Array.isArray(parsed)?parsed.filter(s=>!s?.previewInitialized&&s?.messages?.length&&!s.messages.some(m=>m.role==='assistant')).map(s=>s.id):[]);cached=Array.isArray(parsed)?parsed.filter(s=>s&&typeof s.id==='string'&&typeof s.agentId==='string'&&Array.isArray(s.messages)).map(previewLegacyChat):[]}catch{cached=[]}return cached}
export function saveAgentChats(next:AgentSession[]){try{localStorage.setItem(teamKey(CHAT_KEY),JSON.stringify(next));cachedRaw=undefined;window.dispatchEvent(new Event('mw-agent-chats-change'));return true}catch{return false}}
function subscribe(fn:()=>void){const onStorage=(e:StorageEvent)=>{if(e.key===teamKey(CHAT_KEY)||e.key===null)fn()};window.addEventListener('mw-team-change',fn);window.addEventListener('mw-agent-chats-change',fn);window.addEventListener('storage',onStorage);return()=>{window.removeEventListener('mw-team-change',fn);window.removeEventListener('mw-agent-chats-change',fn);window.removeEventListener('storage',onStorage)}}
export function useAgentChats(){return useSyncExternalStore(subscribe,readAgentChats,readAgentChats)}
export function chatUrl(agentId:string,sessionId?:string){return 'agents.html?'+new URLSearchParams({id:agentId,chat:'1',team:currentTeam().id,...(sessionId?{session:sessionId}:{})}).toString()}
export function openAgentChat(agentId:string,sessionId?:string){const url=chatUrl(agentId,sessionId);if(document.body.dataset.page==='agents'&&new URLSearchParams(location.search).get('chat')==='1'){history.pushState(null,'',url);window.dispatchEvent(new Event('mw-agent-chat-route'))}else location.href=url}
