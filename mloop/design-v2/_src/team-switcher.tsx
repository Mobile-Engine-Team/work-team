import React,{useEffect,useRef,useState} from 'react';
import {Check,ChevronDown,Plus,Search,Settings,Users} from 'lucide-react';
import {switchTeam,useTeams,useTeam} from './team-context';
import {CreateTeamDialog,TeamAvatar,TeamSettingsDialog} from './team-management';
import './team-switcher.css';

export function TeamSwitcher(){
  const team=useTeam(),teams=useTeams(),[open,setOpen]=useState(false),[query,setQuery]=useState('');
  const [dialog,setDialog]=useState(()=>new URLSearchParams(location.search).has('workspace-settings')?'settings':'');
  const [settingsTab,setSettingsTab]=useState(()=>new URLSearchParams(location.search).get('workspace-settings')||'general');
  const closeDialog=()=>{setDialog('');const url=new URL(location.href);url.searchParams.delete('workspace-settings');history.replaceState(null,'',url);trigger.current?.focus()};
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setOpen(false);trigger.current?.focus()}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true)};
  },[open]);
  return <div className="team-switcher" ref={root}>
    <button ref={trigger} className={'team-switch-trigger '+(open?'is-open':'')} aria-label={'切换团队工作区：'+team.name} aria-expanded={open} aria-haspopup="dialog" onClick={()=>{setOpen(!open);setQuery('')}}>
      <span className="team-switch-label">{team.name}</span><ChevronDown size={12}/>
    </button>
    {open&&<section className="team-switch-menu" role="dialog" aria-label="切换团队工作区">
      <header><strong>切换团队工作区</strong><span>{teams.length} 个团队</span></header>
      <label className="team-switch-search"><Search size={15}/><input autoFocus aria-label="搜索团队" placeholder="搜索团队" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <div className="team-switch-options">{teams.filter(t=>(t.name+t.description).includes(query.trim())).map(t=><button key={t.id} className={team.id===t.id?'selected':''} aria-label={'切换到'+t.name} aria-pressed={team.id===t.id} onClick={()=>{setOpen(false);switchTeam(t.id);trigger.current?.focus()}}><TeamAvatar team={t}/><span><strong>{t.name}</strong><small>{t.description?t.description+' · ':''}{t.role}</small></span>{team.id===t.id&&<Check size={16}/>}</button>)}{!teams.some(t=>(t.name+t.description).includes(query.trim()))&&<p className="team-switch-empty">没有找到团队</p>}</div>
      <div className="team-switch-actions"><button onClick={()=>{setOpen(false);setDialog('create')}}><Plus size={16}/>创建团队工作区</button><button onClick={()=>{setOpen(false);setSettingsTab('general');setDialog('settings')}}><Settings size={16}/>工作区设置<small>当前团队</small></button></div>
      <footer><Users size={14}/><span>切换团队内容，Work 任务始终保留</span></footer>
    </section>}
    {dialog==='create'&&<CreateTeamDialog onClose={closeDialog}/>}
    {dialog==='settings'&&<TeamSettingsDialog key={team.id} initialTab={settingsTab} onClose={closeDialog}/>}
  </div>;
}
