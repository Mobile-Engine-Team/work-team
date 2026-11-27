import {recordHabit} from './a2ui-habits';
import React,{useEffect,useRef,useState} from 'react';
import {Check,ChevronDown,FlaskConical,Plus,Search,Settings,Users} from 'lucide-react';
import {switchTeam,useTeams,useTeam} from './team-context';
import {CreateTeamDialog,TeamAvatar,TeamSettingsDialog} from './team-management';
import {createLocalDemo} from './local-demo';
import {identity,useIdentity} from './local-identity';
import {useWorkspace} from './multica-ui/store';
import {localTeamRole} from './team-access';
import './team-switcher.css';

export function TeamSwitcher(){
  const team=useTeam(),teams=useTeams(),who=useIdentity(),role=localTeamRole(team,useWorkspace().members,who),[open,setOpen]=useState(false),[query,setQuery]=useState('');
  const [dialog,setDialog]=useState(()=>new URLSearchParams(location.search).has('workspace-settings')?'settings':'');
  const [settingsTab,setSettingsTab]=useState(()=>new URLSearchParams(location.search).get('workspace-settings')||'general');
  const [inviteOnOpen,setInviteOnOpen]=useState(false);
  useEffect(()=>{const handler=(event:Event)=>{const detail=(event as CustomEvent).detail||{};setOpen(false);setSettingsTab(detail.tab==='members'?'members':'general');setInviteOnOpen(!!detail.invite);setDialog('settings')};window.addEventListener('mw-open-team-settings',handler);return()=>window.removeEventListener('mw-open-team-settings',handler)},[]);
  const closeDialog=()=>{setDialog('');setInviteOnOpen(false);const url=new URL(location.href);url.searchParams.delete('workspace-settings');url.searchParams.delete('member');history.replaceState(null,'',url);trigger.current?.focus()};
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setOpen(false);trigger.current?.focus()}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true)};
  },[open]);
  return <div className="team-switcher" ref={root}>
    <button ref={trigger} className={'team-switch-trigger '+(open?'is-open':'')} aria-label={'切换团队：'+team.name} aria-expanded={open} aria-haspopup="dialog" onClick={()=>{setOpen(!open);setQuery('')}}>
      <TeamAvatar team={team}/><span className="team-switch-current"><small>当前协作团队</small><strong>{team.name}</strong></span><span className="team-switch-action-label">切换</span><ChevronDown size={14}/>
    </button>
    {open&&<section className="team-switch-menu" role="dialog" aria-label="切换团队">
      <header><strong>切换团队</strong><span>{teams.length} 个团队</span></header>
      <label className="team-switch-search"><Search size={15}/><input autoFocus aria-label="搜索团队" placeholder="搜索团队" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <div className="team-switch-options">{teams.filter(t=>(t.name+t.description).includes(query.trim())).map(t=><button key={t.id} className={team.id===t.id?'selected':''} aria-label={'切换到'+t.name} aria-pressed={team.id===t.id} onClick={()=>{setOpen(false);switchTeam(t.id);trigger.current?.focus()}}><TeamAvatar team={t}/><span><strong>{t.name}</strong><small>{t.description}{team.id===t.id?(t.description?' · ':'')+role:''}</small></span>{team.id===t.id&&<Check size={16}/>}</button>)}{!teams.some(t=>(t.name+t.description).includes(query.trim()))&&<p className="team-switch-empty">没有找到团队</p>}</div>
      <div className="team-switch-actions"><button onClick={()=>{
        try{const sample=createLocalDemo(identity());location.href='work.html?'+new URLSearchParams({team:sample.id,view:'全部项目'})}
        catch{window.dispatchEvent(new CustomEvent('design-toast',{detail:'无法创建样例，请检查浏览器存储空间。'}))}
      }}><FlaskConical size={16}/>新建演示工作区<small>独立样例</small></button><button onClick={()=>{setOpen(false);setDialog('create')}}><Plus size={16}/>创建团队</button><button onClick={()=>{recordHabit('team-settings','open');setOpen(false);setSettingsTab('general');setInviteOnOpen(false);setDialog('settings')}}><Settings size={16}/>团队设置<small>成员 / 权限</small></button></div>
      <footer><Users size={14}/><span>只切换团队任务、成员和文件，原团队内容会保留</span></footer>
    </section>}
    {dialog==='create'&&<CreateTeamDialog onClose={closeDialog}/>}
    {dialog==='settings'&&<TeamSettingsDialog key={team.id+':'+settingsTab+':'+inviteOnOpen} initialTab={settingsTab} initialMember={new URLSearchParams(location.search).get('member')||''} initialInvite={inviteOnOpen} onClose={closeDialog}/>}
  </div>;
}
