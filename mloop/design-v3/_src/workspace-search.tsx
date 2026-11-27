import React,{useEffect,useId,useMemo,useRef,useState} from 'react';
import {ArrowDown,ArrowUp,ArrowUpRight,Bot,Folder,Layers,ListTodo,MessageSquare,MessagesSquare,Search,UserRound,X} from 'lucide-react';
import {Collaboration} from './collaboration';
import {collaborationDirectory} from './member-policy';
import {useConversations,Conversation,conversationUrl,ensureSearchConversation,discardTemporaryConversation,sendConversationMessage} from './collaboration-store';
import {useWorkspace} from './multica-ui/store';
import {registerModal,isTopModal} from './multica-ui/primitives';
import {useIdentity} from './local-identity';
import {teamUrl} from './team-context';
import {noticeAnchor} from './notifications';

const categories={'会话':MessageSquare,'聊天记录':MessagesSquare,'成员':UserRound,'智能体':Bot,'智能体小队':Layers,'任务':ListTodo,'项目':Folder};
type Result={kind:keyof typeof categories;title:string;detail:string;href:string;anchor?:string};
const plain=(s:string)=>s.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').trim();
function SearchContent({conversation,onClose,initialMode='quick'}:{conversation?:Conversation;onClose:()=>void;initialMode?:string}){
 const all=useConversations(),data=useWorkspace(),who=useIdentity();
 const [q,setQ]=useState(''),[mode,setMode]=useState(initialMode==='chat'?'smart':initialMode),[kind,setKind]=useState('全部'),[workId,setWorkId]=useState(''),[active,setActive]=useState(0);
 const temporaryId=useRef(''),results=useRef<HTMLDivElement>(null),resultId=useId();
 const switchMode=(next:string)=>{
  if(next==='smart'&&conversation){const id=temporaryId.current||ensureSearchConversation(conversation.id)?.id;if(id){temporaryId.current=id;setWorkId(id);if(q.trim()){sendConversationMessage(id,q.trim(),[],data);setQ('')}}}
  setMode(next);
 };
 useEffect(()=>{if(initialMode!=='quick')switchMode('smart');return()=>{if(temporaryId.current)discardTemporaryConversation(temporaryId.current);temporaryId.current=''}},[who]);
 const rows=useMemo(()=>{
  const directory=collaborationDirectory(data),allowed=(conversation?[conversation]:all).filter(c=>!c.transient&&!c.sourceConversationId&&c.members.includes(who));
  const output:Result[]=allowed.flatMap(c=>{
   const link=conversationUrl(c.id);
   const messages:Result[]=c.messages.filter(m=>(!m.visibleTo||m.visibleTo===who)&&m.text).map(m=>{const anchor=noticeAnchor('message:'+c.id+':'+m.id);return {kind:'聊天记录',title:plain(m.text),detail:m.author+' · '+c.title,href:link+'#'+anchor,anchor}});
   return conversation?messages:[{kind:'会话',title:c.title,detail:c.members.join('、'),href:link} as Result,...messages];
  });
  const projects=conversation?[conversation.project,...conversation.messages.flatMap(m=>(!m.visibleTo||m.visibleTo===who)&&m.surface&&['project','risk'].includes(m.surface.result.spec.kind)?[m.surface.result.spec.subject]:[])].filter(Boolean):[];
  output.push(...data.issues.filter(i=>!i.archived&&(!conversation||conversation.issues.includes(i.id)||projects.includes(i.project))).map((i):Result=>({kind:'任务',title:i.title,detail:[i.assignee,i.status,plain(i.description||'')].filter(Boolean).join(' · '),href:teamUrl('work.html?issue='+i.id)})));
  if(!conversation)output.push(
   ...directory.members.filter((m,i,a)=>a.findIndex(n=>n.name===m.name)===i).map((m):Result=>({kind:'成员',title:m.name,detail:m.email||'',href:teamUrl('space.html?workspace-settings=members&member='+encodeURIComponent(m.name))})),
   ...directory.agents.filter((m,i,a)=>a.findIndex(n=>n.name===m.name)===i).map((a):Result=>({kind:'智能体',title:a.name,detail:'',href:teamUrl('agents.html'+(a.id?'?id='+encodeURIComponent(a.id):''))})),
   ...directory.squads.filter((m,i,a)=>a.findIndex(n=>n.name===m.name)===i).map((a):Result=>({kind:'智能体小队',title:a.name,detail:'',href:teamUrl('squads.html'+(a.id?'?id='+encodeURIComponent(a.id):''))})),
   ...data.projects.map((p):Result=>({kind:'项目',title:p.name,detail:p.description||'',href:teamUrl('work.html?project='+encodeURIComponent(p.name))})),
  );
  return output;
 },[all,conversation,data,who]);
 const tokens=q.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const found=tokens.length?rows.filter(r=>(kind==='全部'||kind===r.kind)&&tokens.every(t=>(r.title+' '+r.detail).toLocaleLowerCase().includes(t))):[];
 const selected=Math.min(active,Math.max(0,found.length-1));
 const changeActive=(delta:number)=>{if(!found.length)return;const next=(selected+delta+found.length)%found.length;setActive(next);results.current?.querySelectorAll('a')[next]?.scrollIntoView({block:'nearest'})};
 const closeButton=<button type="button" className="fx-search-close" aria-label={initialMode==='chat'?'关闭聊天':'关闭搜索'} title="关闭 (Esc)" onClick={onClose}><X size={17}/></button>;
 return <>
  {(conversation&&initialMode!=='chat')&&<header className="fx-search-header"><div className="fx-tabs" aria-label="搜索模式">{[['quick','快搜'],['smart','智能']].map(([key,label])=><button key={key} aria-pressed={mode===key} onClick={()=>switchMode(key)}>{label}</button>)}</div>{closeButton}</header>}
  {initialMode==='chat'&&<header className="fx-search-header"><span className="fx-chat-title">Work</span>{closeButton}</header>}
  {mode==='quick'?<>
   <div className="fx-query-row"><form className="fx-query" role="search" onSubmit={e=>{e.preventDefault();if(found.length)results.current?.querySelectorAll('a')[selected]?.click()}}><Search size={20} aria-hidden="true"/><input autoFocus type="search" aria-label={conversation?'搜索当前会话':'全局搜索关键词'} aria-controls={resultId} value={q} onChange={e=>{setQ(e.target.value);setActive(0)}} onKeyDown={e=>{if(!e.nativeEvent.isComposing&&found.length&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();changeActive(e.key==='ArrowDown'?1:-1)}if(e.nativeEvent.isComposing&&e.key==='Enter')e.preventDefault()}} placeholder={conversation?'在此会话中搜索…':'搜索工作区…'}/>{q&&<button type="button" className="fx-query-clear" aria-label="清除关键词" onClick={e=>{setQ('');setActive(0);e.currentTarget.closest('form')?.querySelector('input')?.focus()}}><X size={14}/></button>}</form>{!conversation&&closeButton}</div>
   <div className="fx-kinds" role="group" aria-label="结果类型">{(conversation?['全部','聊天记录','任务']:['全部',...Object.keys(categories)]).map(k=><button key={k} aria-pressed={kind===k} onClick={()=>{setKind(k);setActive(0)}}>{k}</button>)}</div>
   <div className="fx-results" id={resultId} ref={results}>
    {found.length?<><div className="fx-result-count" role="status">{found.length} 条结果</div>{found.map((r,i)=>{const Icon=categories[r.kind];return <a key={r.href+':'+i} className={i===selected?'is-active':undefined} href={r.href} onPointerEnter={()=>setActive(i)} onFocus={()=>setActive(i)} onClick={e=>{if(conversation&&r.anchor&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();const anchor=r.anchor;onClose();requestAnimationFrame(()=>document.getElementById(anchor)?.scrollIntoView({block:'center'}));}}}><span className="fx-result-icon"><Icon size={16}/></span><span className="fx-result-body"><strong>{r.title}</strong><small>{r.kind}{r.detail?' · '+r.detail:''}</small></span><ArrowUpRight size={15} className="fx-result-arrow"/></a>})}</>:<div className="fx-search-empty" role="status"><span><Search size={20}/></span><strong>{tokens.length?'没有找到匹配结果':conversation?'查找会话内容':'快速找到工作内容'}</strong><small>{tokens.length?'试试其他关键词，或切换搜索范围。':conversation?'输入关键词查找消息与关联任务。':'可按标题、成员或消息关键词搜索。'}</small></div>}
   </div>
   {!conversation&&<footer className="fx-search-footer"><span><kbd><ArrowUp size={11}/></kbd><kbd><ArrowDown size={11}/></kbd> 选择</span><span><kbd>↵</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></footer>}
  </>:workId&&<div className="fx-work-session"><Collaboration embedded sidebarWork initialId={workId}/></div>}
 </>;
}
export function GlobalSearch({onClose}:{onClose:()=>void}){
 const panel=useRef<HTMLElement>(null),previous=useRef(document.activeElement as HTMLElement|null);
 useEffect(()=>{const node=panel.current,unregister=registerModal(node);const key=(e:KeyboardEvent)=>{if(!isTopModal(node))return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose()}if(e.key==='Tab'){const items=Array.from(node?.querySelectorAll<HTMLElement>('input,button,a[href]')||[]);if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus()}}};document.addEventListener('keydown',key,true);return()=>{unregister();document.removeEventListener('keydown',key,true);previous.current?.focus()}},[]);
 return <div className="fx-search-overlay fx-global-overlay" onClick={onClose}><section ref={panel} className="fx-global-search" role="dialog" aria-modal="true" aria-label="全局搜索" onClick={e=>e.stopPropagation()}><SearchContent onClose={onClose}/></section></div>;
}
export function ConversationSearch({conversation,onClose,initialMode}:{conversation:Conversation;onClose:()=>void;initialMode?:string}){
 return <aside className="fx-conversation-search" aria-label={initialMode==='chat'?'Work 临时聊天':'会话搜索面板'} onKeyDown={e=>{if(e.key==='Escape'&&!e.defaultPrevented){e.stopPropagation();onClose()}}}><SearchContent key={conversation.id+':'+initialMode} initialMode={initialMode} conversation={conversation} onClose={onClose}/></aside>;
}
