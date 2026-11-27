import React,{useEffect,useRef,useState} from 'react';
import {ArrowUpRight,ChevronDown,Lightbulb,ShieldAlert,Sparkles,X} from 'lucide-react';
import {useWorkspace} from './multica-ui/store';
import {newConversation,sendConversationMessage,conversationUrl,useConversations} from './collaboration-store';
import {useIdentity} from './local-identity';
import {useTeam} from './team-context';
import {readHabits} from './a2ui-habits';
import {analyzeNextSteps} from './proactive-model';
import type {Insight} from './proactive-model';
import './proactive-insights.css';
export function ProactiveInsights(){
 const data=useWorkspace(),conversations=useConversations(),who=useIdentity(),team=useTeam();
 const key='mw-proactive-v2:'+team.id+':'+encodeURIComponent(who);
 const read=()=>{try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return {}}};
 const mark=(patch:any)=>{localStorage.setItem(key,JSON.stringify({...read(),...patch}))};
 const [insight,setInsight]=useState<Insight|null>(null),[expanded,setExpanded]=useState(false),[reasons,setReasons]=useState(false),[error,setError]=useState('');
 const latest=useRef({data,conversations,who});latest.current={data,conversations,who};
 useEffect(()=>{
  const state=read();setInsight(state.pending||null);setExpanded(!!state.pending&&state.expanded===true);setReasons(false);
  let lastInput=Date.now();const typing=()=>{lastInput=Date.now()};document.addEventListener('keydown',typing);
  const check=()=>{
   const s=read(),current=latest.current,candidates=analyzeNextSteps(current.data,current.conversations,current.who,readHabits());
   if(s.pending){const valid=candidates.find(c=>c.id===s.pending.id);if(!valid){mark({pending:null,expanded:false});setInsight(null);setExpanded(false)}else{setInsight(valid);if(JSON.stringify(valid)!==JSON.stringify(s.pending))mark({pending:valid})}return}
   if(document.hidden||document.querySelector('[role="dialog"],dialog[open],.co-task-sidechat')||Date.now()-lastInput<8000||Date.now()<(s.pauseUntil||0)||Date.now()-(s.lastShown||0)<180000)return;
   const pick=candidates.find(c=>Date.now()-(s.seen?.[c.id]||0)>24*3600000);if(!pick)return;
   setInsight(pick);setExpanded(true);setReasons(false);mark({pending:pick,expanded:true,lastShown:Date.now(),seen:{...s.seen,[pick.id]:Date.now()}});
  };
  const first=setTimeout(check,18000),timer=setInterval(check,12000);
  return()=>{clearTimeout(first);clearInterval(timer);document.removeEventListener('keydown',typing)};
 },[key]);
 const toggle=()=>{setExpanded(!expanded);mark({expanded:!expanded})};
 const act=()=>{if(!insight)return;try{const current=latest.current,candidates=analyzeNextSteps(current.data,current.conversations,current.who,readHabits());if(!candidates.some(c=>c.id===insight.id)){mark({pending:null,expanded:false});setInsight(null);setExpanded(false);return}const c=newConversation();sendConversationMessage(c.id,insight.query,[],current.data,{});mark({pending:null,expanded:false});location.href=conversationUrl(c.id)}catch{setError('暂时没有打开成功，再试一次吧。')}};
 return <><button className={'pi-preview '+(insight?'pi-has-insight':'')} aria-label={expanded?'收起 Work 主动提醒':'展开 Work 主动提醒'} aria-expanded={expanded} title="Work 主动提醒" onClick={toggle}><span className="pi-preview-icon"><Sparkles size={17}/></span>{insight&&<span className="pi-preview-copy">有件事想提醒您<i/></span>}</button>{expanded&&<aside className={'pi-toast pi-tone-'+(insight?.tone||'planning')} aria-label="Work 主动建议" role="complementary"><header><span><Sparkles size={13}/>Work · 多想一步</span><button aria-label="收起主动建议" onClick={toggle}><X size={15}/></button></header>{insight?<><div className="pi-title"><span>{insight.tone==='risk'?<ShieldAlert size={20}/>:<Lightbulb size={20}/>}</span><h3>{insight.title}</h3></div><p>{insight.summary}</p><button className="pi-reason-toggle" aria-expanded={reasons} onClick={()=>setReasons(!reasons)}>为什么想到这件事<ChevronDown size={12}/></button>{reasons&&<ul>{insight.evidence.map(e=><li key={e}>{e}</li>)}</ul>}<footer><button onClick={()=>{mark({pauseUntil:Date.now()+3600000,pending:null,expanded:false});setInsight(null);setExpanded(false)}}>一小时后再说</button><button className="pi-action" onClick={act}>一起看一下<ArrowUpRight size={13}/></button></footer><div className="pi-note">{insight.query}</div>{error&&<p role="alert">{error}</p>}</>:<><div className="pi-title"><span><Lightbulb size={20}/></span><h3>先安心做手头的事</h3></div><p>暂时没有需要提醒的事项。有值得关注的变化，我会在这里告诉您。</p></>}</aside>}</>;
}
