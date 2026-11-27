import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,Bot,Check,ChevronDown,Quote,Search,SquarePen,Users,X} from 'lucide-react';
import {readExpertWorkspace} from './agent-workspace';
import {currentTeam,useTeams} from './team-context';
import {createIssueInTeam,priorities,readTeamWorkspace} from './multica-ui/store';
import './team-assistance.css';

export function TeamAssistance({initialDraft='',quote='',onClose,onCreated}:{initialDraft:string;quote:string;onClose:()=>void;onCreated:()=>void}){
  const teams=useTeams();
  const [teamId,setTeamId]=useState(currentTeam().id),[mode,setMode]=useState<'manual'|'agent'>('manual');
  const directory=useMemo(()=>readExpertWorkspace(teamId),[teamId]);
  const teamData=useMemo(()=>readTeamWorkspace(teamId),[teamId]);
  const squads=directory.squads.filter(s=>!s.archived),agents=directory.agents.filter(a=>!a.archived);
  const [kind,setKind]=useState<'squad'|'agent'>(()=>squads.length?'squad':'agent');
  const [recipient,setRecipient]=useState(squads[0]?.id||agents[0]?.id||'');
  const [creator,setCreator]=useState(agents[0]?'agent:'+agents[0].id:squads[0]?'squad:'+squads[0].id:'');
  const [title,setTitle]=useState(''),[description,setDescription]=useState(initialDraft),[prompt,setPrompt]=useState(initialDraft);
  const [query,setQuery]=useState(''),[project,setProject]=useState(''),[priority,setPriority]=useState('无优先级');
  const [error,setError]=useState(''),[saving,setSaving]=useState(false);
  const panel=useRef<HTMLElement>(null),titleInput=useRef<HTMLInputElement>(null),promptInput=useRef<HTMLTextAreaElement>(null),busy=useRef(false);
  const list=kind==='squad'?squads:agents;
  const visible=list.filter(item=>(item.name+' '+item.description).toLowerCase().includes(query.toLowerCase().trim()));
  const selected=list.find(item=>item.id===recipient);
  const creatorType=creator.split(':')[0],creatorId=creator.slice(creator.indexOf(':')+1);
  const selectedCreator=(creatorType==='squad'?squads:agents).find(item=>item.id===creatorId);
  const text=mode==='manual'?description:prompt;
  const canCreate=mode==='manual'?title.trim()&&selected:prompt.trim()&&selectedCreator;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement;
    titleInput.current?.focus();
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();onClose()}
      if(event.key==='Tab'){
        const all=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea,select,a[href]')||[]).filter(e=>e.getClientRects().length>0);
        const first=all[0],last=all[all.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
      }
    };
    document.addEventListener('keydown',keydown,true);
    return()=>{document.removeEventListener('keydown',keydown,true);previous?.focus()};
  },[]);
  const chooseMode=(next:'manual'|'agent')=>{setMode(next);setError('');requestAnimationFrame(()=>next==='manual'?titleInput.current?.focus():promptInput.current?.focus())};
  const chooseKind=(value:'squad'|'agent')=>{setKind(value);setRecipient((value==='squad'?squads:agents)[0]?.id||'');setQuery('');setError('')};
  const chooseTeam=(value:string)=>{
    const next=readExpertWorkspace(value),nextSquads=next.squads.filter(s=>!s.archived),nextAgents=next.agents.filter(a=>!a.archived);
    setTeamId(value);setKind(nextSquads.length?'squad':'agent');setRecipient(nextSquads[0]?.id||nextAgents[0]?.id||'');
    setCreator(nextAgents[0]?'agent:'+nextAgents[0].id:nextSquads[0]?'squad:'+nextSquads[0].id:'');setProject('');setQuery('');setError('');
  };
  const quoteConversation=()=>{
    if(!quote||text.includes(quote))return;
    const next=(text.trim()?text.trim()+'\n\n':'')+'参考对话\n'+quote;
    mode==='manual'?setDescription(next):setPrompt(next);
    setError('');
  };
  const create=()=>{
    if(busy.current||!canCreate)return;
    busy.current=true;setSaving(true);setError('');
    try{
      const latest=readExpertWorkspace(teamId);
      const actorKind=mode==='manual'?kind:creatorType,actorId=mode==='manual'?recipient:creatorId;
      const actor=(actorKind==='squad'?latest.squads:latest.agents).find(item=>item.id===actorId&&!item.archived);
      if(!actor)throw new Error('执行方已更新，请重新选择');
      // Both static modes save an ordinary issue. No conversation relation or run is created.
      createIssueInTeam(teamId,{title:mode==='manual'?title.trim():prompt.trim().split('\n')[0].slice(0,80),description:text.trim(),assignee:actor.name,status:'待办',priority,project});
      onCreated();
    }catch(cause){setError(cause instanceof Error&&cause.message==='执行方已更新，请重新选择'?cause.message:'创建失败，请重试。已保留填写的内容。')}
    finally{busy.current=false;setSaving(false)}
  };
  return <div className="ta-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section ref={panel} className="ta-panel" role="dialog" aria-modal="true" aria-labelledby="ta-title">
      <header className="ta-header"><h2 id="ta-title">团队协助</h2><button className="ta-icon-button" aria-label="关闭团队协助" onClick={onClose}><X size={18}/></button></header>
      <div className="ta-content">
        <div className="ta-create-modes" role="group" aria-label="创建方式"><button aria-pressed={mode==='manual'} onClick={()=>chooseMode('manual')}><SquarePen size={15}/>手动创建</button><button aria-pressed={mode==='agent'} onClick={()=>chooseMode('agent')}><Bot size={16}/>智能体创建</button></div>
        <div className="ta-team-line"><label htmlFor="ta-team">团队工作区</label><div className="ta-inline-select"><select id="ta-team" aria-label="协助团队" value={teamId} onChange={event=>chooseTeam(event.target.value)}>{teams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select><ChevronDown size={13}/></div></div>
        {mode==='manual'?<>
          <div className="ta-task-fields"><input ref={titleInput} className="ta-title-input" aria-label="任务标题" placeholder="任务标题" maxLength={120} value={title} onChange={event=>{setTitle(event.target.value);setError('')}}/><div className="ta-description"><textarea aria-label="任务描述" placeholder="补充背景、目标和期望的交付结果…" value={description} onChange={event=>setDescription(event.target.value)}/><button className="ta-quote" disabled={!quote||description.includes(quote)} onClick={quoteConversation}><Quote size={13}/>{quote&&description.includes(quote)?'已引用对话':'引用当前对话'}</button></div></div>
          <section className="ta-recipient-section"><div className="ta-section-heading"><label>执行方</label><div className="ta-target-tabs"><button aria-pressed={kind==='squad'} onClick={()=>chooseKind('squad')}>小队</button><button aria-pressed={kind==='agent'} onClick={()=>chooseKind('agent')}>智能体</button></div></div>
            <label className="ta-target-search"><Search size={14}/><input aria-label="搜索执行方" placeholder="搜索名称或能力" value={query} onChange={event=>setQuery(event.target.value)}/></label>
            <div className="ta-target-list" role="group" aria-label="选择执行方">{visible.map(item=><label className={'ta-recipient '+(recipient===item.id?'is-selected':'')} key={item.id}><input type="radio" name="ta-recipient" aria-label={item.name} checked={recipient===item.id} onChange={()=>setRecipient(item.id)}/><span className="ta-object-icon">{kind==='squad'?<Users size={17}/>:<Bot size={17}/>}</span><span className="ta-recipient-text"><strong>{item.name}</strong><small>{kind==='squad'?item.members.length+' 位成员 · '+(item.description||'小队协作'):item.description||'智能体'}</small></span><span className="ta-radio">{recipient===item.id&&<Check size={10}/>}</span></label>)}{!visible.length&&<p className="ta-empty">{query?'没有匹配的执行方':'暂无可用'+(kind==='squad'?'小队':'智能体')}<a href={(kind==='squad'?'squads':'agents')+'.html?team='+teamId} target="_blank" rel="noopener noreferrer">查看{kind==='squad'?'小队':'智能体'}<ArrowUpRight size={12}/></a></p>}</div>
          </section>
        </>:<section className="ta-agent-create">
          <div className="ta-creator"><label htmlFor="ta-creator">创建者</label><div className="ta-creator-select"><Bot size={16}/><select id="ta-creator" aria-label="创建智能体或小队" value={creator} onChange={event=>setCreator(event.target.value)}>{!agents.length&&!squads.length&&<option value="">暂无可用创建者</option>}<optgroup label="智能体">{agents.map(agent=><option key={agent.id} value={'agent:'+agent.id}>{agent.name}</option>)}</optgroup><optgroup label="小队">{squads.map(squad=><option key={squad.id} value={'squad:'+squad.id}>{squad.name}</option>)}</optgroup></select><ChevronDown size={13}/></div></div>
          <p className="ta-agent-hint">描述你要推进的工作，以及期望的结果。</p>
          <div className="ta-description ta-agent-description"><textarea ref={promptInput} aria-label="任务需求" placeholder="例如：整理本周项目进展，拆解待办事项，并为每项任务补充验收标准。" value={prompt} onChange={event=>setPrompt(event.target.value)}/><button className="ta-quote" disabled={!quote||prompt.includes(quote)} onClick={quoteConversation}><Quote size={13}/>{quote&&prompt.includes(quote)?'已引用对话':'引用当前对话'}</button></div>
        </section>}
        <div className="ta-properties"><label><span>项目</span><div className="ta-property-select"><select aria-label="任务项目" value={project} onChange={event=>setProject(event.target.value)}><option value="">无关联项目</option>{teamData.projects.map(item=><option key={item.name}>{item.name}</option>)}</select><ChevronDown size={12}/></div></label><label><span>优先级</span><div className="ta-property-select"><select aria-label="任务优先级" value={priority} onChange={event=>setPriority(event.target.value)}>{priorities.map(value=><option key={value}>{value}</option>)}</select><ChevronDown size={12}/></div></label></div>
        {error&&<p className="ta-error" role="alert">{error}</p>}
      </div>
      <footer className="ta-footer"><span>静态演示</span><button className="ta-cancel" onClick={onClose}>取消</button><button className="ta-submit" onClick={create} disabled={saving||!canCreate}>{saving?'正在保存…':'创建任务'}</button></footer>
    </section>
  </div>;
}
