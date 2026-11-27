import React,{useMemo,useState} from 'react';
import {ArrowUpRight,Check,ChevronRight,Clock3,FileText,FolderKanban,LayoutGrid,ListTodo,Settings,ShieldAlert,Sparkles,UserRound,Users} from 'lucide-react';
import {ENTRY_CATALOG,recognizeEntry,recommendFromHabits} from './a2ui-entry-model';
import type {EntrySurface,Habit} from './a2ui-entry-model';
import {recordHabit,useHabits} from './a2ui-habits';
import {currentTeam} from './team-context';
import {recognizeQuery} from './a2ui-query';
import {useWorkspace} from './multica-ui/store';
import {useIdentity} from './local-identity';
import {localTeamRole,mayManageTeam} from './team-access';
import type {Workspace} from './multica-ui/store';
import type {Conversation} from './collaboration-store';
import './a2ui-entry.css';
const icons={person:UserRound,project:FolderKanban,risk:ShieldAlert,users:Users,settings:Settings,task:ListTodo,clock:Clock3,model:Sparkles,skill:LayoutGrid,file:FileText};
export function EntryCard({entry}:{entry:EntrySurface}){
 const item=ENTRY_CATALOG.find(e=>e.id===entry.id),[error,setError]=useState(''),data=useWorkspace(),who=useIdentity();if(!item)return null;
 const Icon=icons[item.icon],team=currentTeam(),readonly=entry.id==='invite'&&!mayManageTeam(localTeamRole(team,data.members,who));
 const open=()=>{
  if(team.id!==entry.teamId){setError('请切换到「'+entry.teamName+'」后打开此入口。');return}
  setError('');recordHabit(item.id,'open');
  if('href'in item){location.href=item.href+'?'+new URLSearchParams({team:entry.teamId});return}
  if(item.modal==='task')window.dispatchEvent(new CustomEvent('design-create-board-task',{detail:{initial:{mode:'manual'}}}));
  else window.dispatchEvent(new CustomEvent('mw-open-team-settings',{detail:{tab:item.modal==='invite'?'members':'general',invite:item.modal==='invite'}}));
 };
 return <div className="a2-entry-answer"><p className="a2-entry-intro">已经为您展示{item.title}的入口，您可以点击打开。</p><section className="a2-entry-card a2-reveal" aria-label={item.title+'入口'}><header><span className={'a2-preset-icon a2-preset-'+item.tone}><Icon size={21}/></span><span className="a2-entry-label"><Check size={11}/>已找到功能入口</span></header><h3>{item.title}</h3><p>{item.description}</p><div className="a2-entry-path"><span>{entry.teamName}</span><ChevronRight size={11}/><span>{item.path}</span></div>{readonly&&<small className="a2-entry-permission">邀请操作需由团队所有者或管理员完成，您可打开查看成员管理。</small>}<button onClick={open}>{readonly?'查看成员管理':item.action}<ArrowUpRight size={15}/></button>{error&&<small className="a2-entry-error" role="alert">{error}</small>}</section></div>;
}
export function useWorkRecommendations(conversations:Conversation[],data:Workspace,who:string){
 const habits=useHabits();
 return useMemo(()=>{
  const now=Date.now(),recent=conversations.filter(c=>!c.transient&&!c.sourceConversationId&&c.members.includes(who)).flatMap(c=>c.messages.filter(m=>m.author===who&&m.text&&(!m.visibleTo||m.visibleTo===who)).flatMap(m=>{
   const at=Date.parse(m.sentAt||c.updatedAt||'');if(!Number.isFinite(at)||at>now||now-at>30*86400000)return [];
   const entry=recognizeEntry(m.text),spec=entry?undefined:recognizeQuery(m.text,data,who),key=entry||spec?.kind;
   return key?[{key,kind:'query' as const,at,spec}]:[];
  })).sort((a,b)=>b.at-a.at);
  const events:Habit[]=[...habits,...recent.filter(h=>!habits.some(e=>e.key===h.key&&e.kind===h.kind&&Math.abs(e.at-h.at)<2000))];
  return recommendFromHabits(events,now).map(r=>{
   const spec=recent.find(h=>h.key===r.key)?.spec;
   if(r.key==='person'){
    const subject=spec?.subject&&[who,...data.members.map(m=>m.name),...data.issues.map(i=>i.assignee)].includes(spec.subject)?spec.subject:who;
    return {...r,query:spec?.days===30?`查询 ${subject} 最近 30 天的进展`:spec?.days===0?`查询 ${subject} 全部进展`:`查询 ${subject} 最近 7 天的进展`};
   }
   if(spec&&data.projects.some(p=>p.name===spec.subject)){
    if(r.key==='project')return {...r,query:`查看「${spec.subject}」的整体进度`};
    if(r.key==='risk')return {...r,query:`查看「${spec.subject}」的阻塞和逾期任务`};
   }
   return r;
  });
 },[conversations,data,who,habits]);
}
