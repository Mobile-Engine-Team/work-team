import React,{useEffect,useRef,useState} from 'react';
import {Bell,Check,CheckCheck,MessageSquare,AtSign,ListTodo,ArrowUpRight,X,Inbox} from 'lucide-react';
import {Notice,markNoticesRead,claimNoticeToast} from './notifications';
import {currentTeam} from './team-context';
import {identity} from './local-identity';

const icon=(kind:Notice['kind'],size=17)=>kind==='mention'?<AtSign size={size}/>:kind==='task'||kind==='assignment'?<ListTodo size={size}/>:<MessageSquare size={size}/>;
const count=(n:number)=>n>99?'99+':n;
function timeLabel(time:string){const d=new Date(time);if(!Number.isFinite(d.getTime()))return '较早';const mins=Math.max(0,Math.floor((Date.now()-d.getTime())/60000));return mins<1?'刚刚':mins<60?mins+' 分钟前':mins<1440?Math.floor(mins/60)+' 小时前':d.toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'})}

export function NotificationCenter({notices}:{notices:Notice[]}){
 const [open,setOpen]=useState(false),[filter,setFilter]=useState('unread'),[toast,setToast]=useState<Notice|null>(null);
 const bell=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null),previous=useRef<{scope:string;ids:Set<string>}|null>(null);
 const scope=currentTeam().id+':'+identity(),unread=notices.filter(n=>!n.read),visible=filter==='unread'?unread:notices;
 const close=()=>{setOpen(false);bell.current?.focus()};
 useEffect(()=>{setOpen(false);setToast(null)},[scope]);
 useEffect(()=>{
  if(previous.current?.scope===scope){const added=unread.filter(n=>!previous.current!.ids.has(n.id));if(document.visibilityState==='visible'&&document.hasFocus()){const next=added.filter(n=>claimNoticeToast(n.id));if(next.length)setToast(next[0])}}
  previous.current={scope,ids:new Set(notices.map(n=>n.id))};
 },[notices,scope]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),7000);return()=>clearTimeout(timer)},[toast?.id]);
 useEffect(()=>{if(toast&&notices.find(n=>n.id===toast.id)?.read)setToast(null)},[notices]);
 useEffect(()=>{const base=document.title.replace(/^\(\d+\+?\) /,'');document.title=unread.length?'('+count(unread.length)+') '+base:base;return()=>{document.title=base}},[unread.length]);
 useEffect(()=>{if(!open)return;panel.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')close()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[open]);

 // Observe the actual message/comment, respecting every scroll container and page focus.
 useEffect(()=>{
  if(open)return;
  const wanted=new Set(unread.map(n=>n.id)),timers=new Map<Element,ReturnType<typeof setTimeout>>();
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){const el=entry.target;clearTimeout(timers.get(el));timers.delete(el);if(entry.isIntersecting&&entry.intersectionRect.height>=Math.min(20,entry.boundingClientRect.height)&&document.visibilityState==='visible'&&document.hasFocus())timers.set(el,setTimeout(()=>{if(document.visibilityState==='visible'&&document.hasFocus()&&el.isConnected)markNoticesRead([el.getAttribute('data-notice-id')!])},800))}},{threshold:[0,.01,.5,1]});
  const scan=()=>{observer.disconnect();for(const timer of timers.values())clearTimeout(timer);timers.clear();document.querySelectorAll('[data-notice-id]').forEach(el=>{if(wanted.has(el.getAttribute('data-notice-id')!))observer.observe(el)})};
  const mutations=new MutationObserver(scan);mutations.observe(document.querySelector('.design-panel')||document.body,{subtree:true,childList:true});
  window.addEventListener('focus',scan);window.addEventListener('blur',scan);document.addEventListener('visibilitychange',scan);scan();
  return()=>{observer.disconnect();mutations.disconnect();for(const timer of timers.values())clearTimeout(timer);window.removeEventListener('focus',scan);window.removeEventListener('blur',scan);document.removeEventListener('visibilitychange',scan)};
 },[scope,open,unread.map(n=>n.id).join('|')]);

 useEffect(()=>{
  const jump=()=>{if(!location.hash.startsWith('#notice-'))return;const el=document.getElementById(location.hash.slice(1));if(el)el.scrollIntoView({block:'center',behavior:'instant'})};
  const timer=setTimeout(jump,150);window.addEventListener('hashchange',jump);
  return()=>{clearTimeout(timer);window.removeEventListener('hashchange',jump)};
 },[scope,notices.map(n=>n.id).join('|')]);
 const follow=(n:Notice)=>{markNoticesRead([n.id]);setOpen(false);setToast(null)};
 return <>
  <button ref={bell} className={'mw-notice-bell '+(open?'is-active':'')} aria-label={'通知'+(unread.length?'，'+unread.length+' 条未读':'')} title="通知" aria-expanded={open} aria-controls="mw-notice-panel" onClick={()=>setOpen(!open)}><Bell size={16}/>{unread.length>0&&<b>{count(unread.length)}</b>}</button>
  {open&&<><div className="mw-notice-scrim" onClick={close}/><aside id="mw-notice-panel" className="mw-notice-panel" aria-label="通知中心" role="dialog" tabIndex={-1} ref={panel}>
   <header><div><h2>通知</h2><p>{unread.length?'有 '+unread.length+' 条动态等你查看':'你的协作动态，都在这里'}</p></div><button aria-label="关闭通知" onClick={close}><X size={18}/></button></header>
   <div className="mw-notice-tools"><div role="tablist" aria-label="通知筛选"><button role="tab" aria-selected={filter==='unread'} onClick={()=>setFilter('unread')}>未读{unread.length>0&&<span>{count(unread.length)}</span>}</button><button role="tab" aria-selected={filter==='all'} onClick={()=>setFilter('all')}>全部</button></div><button className="mw-notice-read-all" disabled={!unread.length} onClick={()=>markNoticesRead(unread.map(n=>n.id))}><CheckCheck size={14}/>全部已读</button></div>
   <div className="mw-notice-list">{visible.map(n=><article className={'mw-notice-item '+(!n.read?'is-unread':'')} key={n.id}><a href={n.href} onClick={e=>{if(n.inviteId){e.preventDefault();window.dispatchEvent(new CustomEvent('mw-accept-invitation',{detail:n.inviteId}))}follow(n)}}><span className={'mw-notice-icon kind-'+n.kind}>{icon(n.kind)}</span><div><div className="mw-notice-item-heading"><strong>{n.title}</strong><time title={n.time?new Date(n.time).toLocaleString('zh-CN'):''}>{timeLabel(n.time)}</time></div><p>{n.text}</p><small>{n.kind==='invitation'?'邀请通知':n.kind==='task'?'新任务':n.kind==='assignment'?'任务指派':n.kind==='reply'?'回复':n.kind==='mention'?'@我':'新消息'}<i/> {n.context}</small></div></a>{!n.read&&<button className="mw-notice-read" aria-label={'标为已读：'+n.title} title="标为已读" onClick={()=>markNoticesRead([n.id])}><Check size={14}/></button>}</article>)}{!visible.length&&<div className="mw-notice-empty"><span>{filter==='unread'?<CheckCheck size={25}/>:<Inbox size={25}/>}</span><h3>{filter==='unread'?'暂时没有未读通知':'还没有协作动态'}</h3><p>{filter==='unread'?'新消息、回复和任务指派会提醒你。':'开始与伙伴讨论，一起推进任务。'}</p></div>}</div>
   <footer><span className="mw-notice-live"/>消息、回复与任务 · 实时同步</footer>
  </aside></>}
  {toast&&!open&&<div className="mw-notice-toast" role="status" aria-live="polite"><a href={toast.href} onClick={e=>{if(toast.inviteId){e.preventDefault();window.dispatchEvent(new CustomEvent('mw-accept-invitation',{detail:toast.inviteId}))}follow(toast)}}><span className={'mw-notice-icon kind-'+toast.kind}>{icon(toast.kind)}</span><div><strong>{toast.title}</strong><p>{toast.text}</p><small>{toast.context}<ArrowUpRight size={12}/></small></div></a><button aria-label="关闭消息提醒" onClick={()=>setToast(null)}><X size={15}/></button></div>}
 </>;
}
