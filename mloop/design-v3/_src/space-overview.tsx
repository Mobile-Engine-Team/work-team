import React,{useState} from 'react';
import {ArrowUpRight,Bot,Check,Copy,FolderKanban,Info,MonitorCog,Pencil,Server,ShieldCheck,Users} from 'lucide-react';
import {useTeam} from './team-context';
import {useWorkspace} from './multica-ui/store';
import {RuntimeSettings} from './multica-ui/runtime-settings';
import {useRuntimeState} from './multica-ui/runtime-store';
import {useIdentity} from './local-identity';
import {localTeamRole,mayManageTeam} from './team-access';
import {readExpertWorkspace} from './agent-workspace';
import './space-overview.css';

function Metric({icon:Icon,label,value,hint}:any){
 return <div className="space-metric"><span><Icon size={17}/></span><div><strong>{value}</strong><small>{label}</small></div><em>{hint}</em></div>;
}

export function SpaceOverview(){
 const team=useTeam(),workspace=useWorkspace(),runtime=useRuntimeState(),who=useIdentity();
 const [copied,setCopied]=useState(false);
 const roster=readExpertWorkspace(team.id),agents=roster.agents.filter(a=>!a.archived),squads=roster.squads.filter(s=>!s.archived);
 const activeAgents=agents.filter(a=>a.status==='在线').length,role=localTeamRole(team,workspace.members,who);
 const onlineMachines=runtime.machines.filter((machine:any)=>machine.local?runtime.daemonRunning:machine.online).length;
 const edit=()=>window.dispatchEvent(new CustomEvent('mw-open-team-settings',{detail:{tab:'general'}}));
 const copy=async()=>{try{await navigator.clipboard.writeText(team.id);setCopied(true);setTimeout(()=>setCopied(false),1600)}catch{}};
 return <div className="space-page">
  <header className="design-module-header space-module-header">
   <div><h1>协作空间</h1><p>查看当前空间的成员、共享资料与运行环境。</p></div>
   <span className="space-role"><ShieldCheck size={14}/>{role}</span>
  </header>
  <div className="space-body">
   <section className="space-identity">
    <div className="space-avatar" data-tone={team.color||'blue'}>{team.avatar?<img src={team.avatar} alt=""/>:team.initial||team.name.slice(0,1)}</div>
    <div className="space-identity-copy">
     <div><h2>{team.name}</h2><span>{role}</span></div>
     <p>{team.description||'让伙伴与智能体共享目标、上下文与执行环境，一起把事情向前推进。'}</p>
    </div>
    <button className="space-secondary-action" onClick={edit}><Pencil size={15}/>{mayManageTeam(role)?'编辑空间资料':'查看空间资料'}</button>
   </section>
   <div className="space-metrics">
    <Metric icon={Users} label="协作成员" value={workspace.members.length} hint={who+' 当前在线'}/>
    <Metric icon={Bot} label="智能体" value={agents.length} hint={activeAgents+' 个在线'}/>
    <Metric icon={Users} label="小队" value={squads.length} hint="按目标组织协作"/>
    <Metric icon={MonitorCog} label="运行机器" value={runtime.machines.length} hint={onlineMachines+' 台在线'}/>
   </div>
   <div className="space-info-grid">
    <section className="space-panel">
     <header><span className="space-panel-icon"><Info size={17}/></span><div><h3>空间资料</h3><p>智能体和成员共同使用的协作背景。</p></div></header>
     <dl className="space-facts">
      <div><dt>空间名称</dt><dd>{team.name}</dd></div>
      <div><dt>空间标识</dt><dd><code>{team.id}</code><button aria-label="复制空间标识" title="复制空间标识" onClick={copy}>{copied?<Check size={14}/>:<Copy size={14}/>}</button></dd></div>
      <div><dt>智能体上下文</dt><dd>{team.context||'尚未设置。可补充业务背景、目标用户与团队协作约定。'}</dd></div>
     </dl>
     <button className="space-text-action" onClick={edit}>管理空间资料<ArrowUpRight size={14}/></button>
    </section>
    <section className="space-panel">
     <header><span className="space-panel-icon space-panel-icon-green"><Users size={17}/></span><div><h3>协作构成</h3><p>人和智能体在同一空间内共享任务与会话。</p></div></header>
     <div className="space-composition">
      <div><span><Users size={15}/></span><strong>{workspace.members.length} 位成员</strong><small>可参与会话、任务与项目</small></div>
      <div><span><Bot size={15}/></span><strong>{agents.length} 个智能体</strong><small>其中 {activeAgents} 个当前在线</small></div>
      <div><span><FolderKanban size={15}/></span><strong>{workspace.projects.length} 个项目</strong><small>承载协作成果与执行记录</small></div>
     </div>
     <button className="space-text-action" onClick={()=>window.dispatchEvent(new CustomEvent('mw-open-team-settings',{detail:{tab:'members'}}))}>管理成员<ArrowUpRight size={14}/></button>
    </section>
   </div>
   <section className="space-runtime" aria-labelledby="space-runtime-title">
    <header>
     <div className="space-runtime-title"><span><Server size={18}/></span><div><h2 id="space-runtime-title">运行时</h2><p>模拟配置本机、远程机器与云端执行环境；不会实际连接或执行命令。</p></div></div>
     <span className="space-runtime-status"><i/>{onlineMachines} 台机器在线</span>
    </header>
    <div className="space-runtime-frame"><RuntimeSettings/></div>
   </section>
  </div>
 </div>;
}
