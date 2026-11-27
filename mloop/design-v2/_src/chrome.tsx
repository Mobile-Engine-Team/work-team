import {TeamSwitcher} from './team-switcher';
import {useTeam} from './team-context';
import {teamGroupNames} from './team-seeds';
import {activeAgents,chatUrl,openAgentChat,useAgentChats} from './agent-chat-store';
import {squadChatSource,squadChatUrl,useSquadChatIds} from './squad-chat-store';
import React, {useState, useRef} from 'react';
import {Plus, PlusCircle, ChevronDown, ChevronRight, X, UserRoundCheck, Check, Folder, Settings, Search, Users, Bot} from 'lucide-react';
import {ComposerGlyphMode, ComposerGlyphSkill, ComposerGlyphExpert, ComposerGlyphTool, ComposerGlyphModel, ComposerGlyphWorkspace} from '@/react-app/design-system/composer-toolbar-glyphs';
import {ExpertTeamGlyph, AutomationGlyph} from '@/react-app/design-system/mw-glyphs';
import {SidebarCollapseIcon, SidebarSearchIcon, SidebarFilterIcon} from '@/react-app/domains/shared/sidebar-brand-icons';
import {AccountAvatar} from '@/react-app/design-system/account-avatar';
import {COMPOSER_ICONS} from '@/react-app/design-system/composer-icons';
import {ListTodo as MulticaWork} from './multica-icons';
import {useWorkspace} from './multica-ui/store';
import {IssueStatusIcon} from './multica-ui/issue-status-icon';

export const SAMPLE_TITLE='持续求解 P=NP 千禧年难题';
export const notify=(text:string)=>window.dispatchEvent(new CustomEvent('design-toast',{detail:text}));
const navigate=(name:string)=>location.href=name+'.html';
export const taskNames=[SAMPLE_TITLE,'启用星语技能','浏览器控制能力询问','Show current working directory','询问模型身份','整理本周会议纪要与待办事项','AI Agent 产品对比研究','制作项目进展汇报 PPT','生成月度经营分析报告'];
export const sessionNames=['测试群聊','产品评审群','设计走查','研发同步','客户交付沟通'];

export function Shell({children}){
  const page=document.body.dataset.page||'index';
  const team=useTeam();
  const data=useWorkspace();
  const agentChats=useAgentChats();
  const squadChats=useSquadChatIds().map(id=>squadChatSource(id)).filter(Boolean);
  const [,refreshRoute]=useState(0);
  React.useEffect(()=>{const refresh=()=>refreshRoute(n=>n+1);window.addEventListener('mw-agent-chat-route',refresh);window.addEventListener('popstate',refresh);return()=>{window.removeEventListener('mw-agent-chat-route',refresh);window.removeEventListener('popstate',refresh)}},[]);
  const chatAgents=activeAgents();
  const isAgentChat=page==='agents'&&new URLSearchParams(location.search).get('chat')==='1';
  const inboxIssues=data.issues.filter(i=>!i.parent&&!i.archived);
  const [collapsed,setCollapsed]=useState(()=>(['agents','squads'].includes(page)||page.startsWith('automation'))&&window.innerWidth<=760),[account,setAccount]=useState(false),[more,setMore]=useState(false),[inboxMore,setInboxMore]=useState(false),[sessionsMore,setSessionsMore]=useState(false),[sessionsOpen,setSessionsOpen]=useState(true),[tasksOpen,setTasksOpen]=useState(true),[spacesOpen,setSpacesOpen]=useState(true),[workspaceOpen,setWorkspaceOpen]=useState(false),[query,setQuery]=useState<string|null>(null),[filter,setFilter]=useState(false);
  const [sessions,setSessions]=useState(()=>teamGroupNames(sessionNames));
  React.useEffect(()=>{setSessions(teamGroupNames(sessionNames));setQuery(null)},[team.id]);
  const params=new URLSearchParams(location.search);
  const inboxCurrent=Number(params.get('issue'))||(inboxIssues[0]?.id??3);
  const taskCurrent=Number(params.get('task'))||0;
  const sessionCurrent=Number(params.get('g'))||0;
  React.useEffect(()=>{const listener=(event:Event)=>setSessions(list=>{const next=[...list];next[sessionCurrent]= (event as CustomEvent<string>).detail;return next});window.addEventListener('design-group-name',listener);return()=>window.removeEventListener('design-group-name',listener)},[sessionCurrent]);
  const q=(query||'').toLowerCase();
  const sessionHits=sessions.map((name,id)=>({name,id})).filter(item=>!q||item.name.toLowerCase().includes(q));
  const conversationTasks=data.issues.filter(i=>!i.parent&&!i.archived).slice(0,2);
  const tasks=conversationTasks.filter(i=>!q||i.title.toLowerCase().includes(q));
  const ordinaryChats=taskNames.map((title,id)=>({title,id})).filter(item=>!q||item.title.toLowerCase().includes(q));
  const inboxHits=inboxIssues.filter(item=>!q||item.title.toLowerCase().includes(q));
  const privateChats=agentChats.filter(s=>chatAgents.some(a=>a.id===s.agentId)&&(!q||(s.title+' '+chatAgents.find(a=>a.id===s.agentId)?.name).toLowerCase().includes(q))).sort((a,b)=>b.updated.localeCompare(a.updated));
  const taskTotal=taskNames.length+conversationTasks.length+inboxIssues.length+agentChats.filter(s=>chatAgents.some(a=>a.id===s.agentId)).length;
  const privateCurrent=params.get('session')||agentChats.filter(s=>s.agentId===(params.get('id')||chatAgents[0]?.id)).sort((a,b)=>b.updated.localeCompare(a.updated))[0]?.id;
  const sessionPreview=3;
  const ordinaryPreview=5;
  const inboxPreview=5;
  const showAll=!query;
  return <div className={'design-shell desktop-mac '+(collapsed?'hide-sidebar':'')}>
    <div className="mac-traffic" aria-hidden="true"><i/><i/><i/></div>
    <aside className="design-sidebar">
      <div className="mac-sidebar-controls">
        <button aria-label="搜索任务" onClick={()=>setQuery(query===null?'':null)}><SidebarSearchIcon className="size-4"/></button>
        <button aria-label="筛选任务" onClick={()=>setFilter(!filter)}><SidebarFilterIcon className="size-4"/></button>
        <button aria-label="收起侧栏" onClick={()=>setCollapsed(true)}><SidebarCollapseIcon className="size-4"/></button>
        {filter&&<div className="chrome-filter"><button onClick={()=>{setFilter(false);notify('已显示全部任务')}}><Check size={14}/>全部任务</button><button onClick={()=>{setFilter(false);notify('暂无进行中的任务')}}>进行中</button><button onClick={()=>{setFilter(false);notify('已显示已完成任务')}}>已完成</button></div>}
      </div>
      <div className="sidebar-brand-row"><a className="mac-brand" href="index.html"><img className="mac-brand-mark" src="brand-symbol.png" alt=""/><img className="mac-brand-word" src="sidebar-brand-logo.png" alt="MobileWork"/></a><TeamSwitcher/></div>
      <div className="sidebar-new-task"><a href="index.html"><PlusCircle size={18}/>新建任务</a></div>
      <nav className="sidebar-modules">
        <a href="skills.html" className={'design-nav '+(!isAgentChat&&['skills','skills-installed','skill-detail','experts','my-experts','tools','my-tools','agents','squads'].includes(page)?'active':'')}><span><ExpertTeamGlyph className="size-4"/>专家工作区</span><small>专家 / 技能 / 工具</small></a>
        <a href="automation.html" className={'design-nav '+(page.startsWith('automation')?'active':'')}><span><AutomationGlyph className="size-4"/>自动化</span><small>任务编排</small></a>
        <a href="work.html" className={'design-nav '+(page==='work'||page.startsWith('work-')?'active':'')}><span><MulticaWork size={16}/>工作看板</span><small>管理工作</small></a>
      </nav>
      <div className="sidebar-rule"/>
      <div className="sidebar-regions">
        <button className="sidebar-section-title" onClick={()=>setSessionsOpen(!sessionsOpen)}><span>会话（{sessions.length+squadChats.length}）</span><ChevronDown size={14} className={sessionsOpen?'':'-rotate-90'}/></button>
        {sessionsOpen&&(sessionHits.length>0||squadChats.length>0)&&(
          <div className="sidebar-tasks sidebar-tasks-merged">
            {squadChats.filter(source=>!q||source.squad.name.toLowerCase().includes(q)).map(source=><a key={source.squad.id} href={squadChatUrl(source.squad.id)} className={'task-row sidebar-group-task '+(page==='group-chat'&&(params.get('squad')||(team.id==='brand'?'content':null))===source.squad.id?'task-active':'')}><Users size={15}/><span>{source.squad.name}</span><small className="sidebar-group-badge">群聊</small></a>)}
            {sessionHits.slice(0,sessionsMore||!showAll?sessionHits.length:sessionPreview).map(item=>(
              <a key={item.id} href={'group-chat.html'+(item.id?'?g='+item.id:'')} className={'task-row sidebar-group-task '+(page==='group-chat'&&!params.has('squad')&&sessionCurrent===item.id?'task-active':'')}>
                <Users size={15}/><span>{item.name}</span><small className="sidebar-group-badge">群聊</small>
              </a>
            ))}
            {showAll&&sessionHits.length>sessionPreview&&(
              <button className="sidebar-show-more" onClick={()=>setSessionsMore(!sessionsMore)}>{sessionsMore?'收起':`查看更多 (${sessionHits.length-sessionPreview})`}</button>
            )}
          </div>
        )}
        <button className="sidebar-section-title" onClick={()=>setTasksOpen(!tasksOpen)}><span>任务（{taskTotal}）</span><ChevronDown size={14} className={tasksOpen?'':'-rotate-90'}/></button>
        {query!==null&&(
          <div className="sidebar-query">
            <Search size={14}/>
            <input autoFocus value={query} placeholder="搜索任务" onChange={e=>setQuery(e.target.value)}/>
            <button aria-label="关闭搜索" onClick={()=>setQuery(null)}><X size={14}/></button>
          </div>
        )}
        {tasksOpen&&(
          <div className="sidebar-tasks sidebar-tasks-merged">
            {(tasks.length>0||privateChats.length>0||ordinaryChats.length>0)&&(
              <div className="sidebar-task-group" data-task-conversations>
                <div className="sidebar-task-label">对话</div>
                {privateChats.slice(0,more||!showAll?privateChats.length:2).map(item=><a key={item.id} title={item.title+' · '+chatAgents.find(a=>a.id===item.agentId)?.name} href={chatUrl(item.agentId,item.id)} onClick={e=>{if(isAgentChat&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();openAgentChat(item.agentId,item.id)}}} className={'task-row sidebar-private-task '+(isAgentChat&&privateCurrent===item.id?'task-active':'')}><Bot size={14}/><span>{item.title}</span><small>私聊</small></a>)}
                {tasks.map(item=><a title={item.title} href={'work.html?issue='+item.id} key={item.id} className={'task-row sidebar-board-task '+(page==='work'&&Number(params.get('issue'))===item.id?'task-active':'')}><MulticaWork size={14}/><span>{item.title}</span><small>任务</small></a>)}
                {ordinaryChats.slice(0,more||!showAll?ordinaryChats.length:ordinaryPreview).map(item=><a title={item.title} href={'task.html?task='+item.id} key={'ordinary-'+item.id} className={'task-row sidebar-ordinary-chat '+(page==='task'&&taskCurrent===item.id?'task-active':'')}><span>{item.title}</span><small>2天前</small></a>)}
                {showAll&&(privateChats.length>2||ordinaryChats.length>ordinaryPreview)&&(
                  <button className="sidebar-show-more" onClick={()=>setMore(!more)}>{more?'收起':`查看更多 (${Math.max(0,privateChats.length-2)+Math.max(0,ordinaryChats.length-ordinaryPreview)})`}</button>
                )}
              </div>
            )}
            {inboxHits.length>0&&(
              <div className={'sidebar-task-group'+(tasks.length?' sidebar-task-group-follow':'')}>
                <div className="sidebar-task-label">与我有关</div>
                {inboxHits.slice(0,inboxMore||!showAll?inboxHits.length:inboxPreview).map(item=>(
                  <a title={item.title} href={'inbox.html?issue='+item.id} key={item.id} className={'task-row task-row-inbox '+(page==='inbox'&&inboxCurrent===item.id?'task-active':'')}>
                    <span className="task-row-inbox-title">
                      {item.read?null:<i className="sidebar-unread-dot" aria-hidden="true"/>}
                      {item.title}
                    </span>
                    <span className="task-row-inbox-meta">
                      <IssueStatusIcon status={item.status}/>
                      <small>{item.ago}</small>
                    </span>
                  </a>
                ))}
                {showAll&&inboxIssues.length>inboxPreview&&(
                  <button className="sidebar-show-more" onClick={()=>setInboxMore(!inboxMore)}>{inboxMore?'收起':`查看更多 (${inboxIssues.length-inboxPreview})`}</button>
                )}
              </div>
            )}
          </div>
        )}
        <div className="sidebar-rule spaces-rule"/>
        <button className="sidebar-section-title spaces-heading" onClick={()=>setSpacesOpen(!spacesOpen)}><span>空间（1）</span><ChevronDown size={14} className={spacesOpen?'':'-rotate-90'}/></button>
        {spacesOpen&&(
          <div>
            <button className="workspace-row" onClick={()=>setWorkspaceOpen(!workspaceOpen)}>
              <Folder size={16}/><span>每日 AI 新闻推送</span><ChevronRight size={14} className={workspaceOpen?'rotate-90':''}/>
            </button>
            {workspaceOpen&&<a className="workspace-child" href="task.html">每日人工智能资讯简报</a>}
          </div>
        )}
      </div>
      <footer className="sidebar-account">
        {account&&<div className="account-popover"><div className="account-popover-user"><AccountAvatar size={32} glyph="肖" tone="brand"/><span>肖叶茂</span></div><div className="sidebar-rule"/>{[['账户管理','settings-account'],['我的文件','files'],['系统设置','settings-system'],['帮助与反馈','settings-help']].map(([label,to])=><a href={to+'.html'} key={to}>{label}<ChevronRight size={14}/></a>)}</div>}
        <button className="account-entry" aria-label="账户菜单" onClick={()=>setAccount(!account)}><AccountAvatar size={32} glyph="肖" tone="brand"/><span>肖叶茂</span><ChevronRight size={14}/></button>
      </footer>
    </aside>
    <main className="design-pane">
      <div className="design-titlebase"><button className="desktop-nav-toggle" aria-label="展开侧栏" onClick={()=>setCollapsed(false)}><SidebarCollapseIcon className="size-4 -scale-x-100"/></button><span className="mac-version"><i/>MW-V1.0.1</span></div>
      <div className="design-panel">{children}</div>
    </main>
  </div>;
}

const menuChoices={mode:['通用模式','深度研究','代码开发'],skill:['日程管理','会议纪要','邮件处理','公文写作'],expert:['财经专家团','深度研究专家团','图表设计与渲染专家'],tool:['邮件系统','智慧云文档','移动云盘'],permission:['默认权限','完全访问'],model:['自动','DeepSeek V3.2','Qwen3'],workspace:['默认工作空间','每日 AI 新闻推送']};

export function Composer({draft,setDraft,home=false,onSend}){
  const [menu,setMenu]=useState<string|null>(null),[selected,setSelected]=useState<Record<string,string>>({model:'自动',permission:'默认权限',workspace:'选工作空间'}),[attached,setAttached]=useState('');
  const upload=useRef<HTMLInputElement>(null);
  const selectMenu=(key:string)=>setMenu(menu===key?null:key);
  const glyph=(Glyph)=> <Glyph className="size-4"/>;
  const feature=(key:string,label:string,Glyph)=> <div className={'composer-feature-wrap composer-feature-'+key} key={key}><button aria-label={label} aria-expanded={menu===key} className={'composer-feature '+(menu===key?'is-open':'')} onClick={()=>selectMenu(key)}>{glyph(Glyph)}<span>{['permission','model'].includes(key)?selected[key]:label}</span><ChevronDown size={15}/></button>{menu===key&&panel(key)}</div>;
  const panel=(key:string)=><div role="menu" className="composer-menu"><div className="composer-menu-title">{({mode:'选择模式',skill:'选择技能',expert:'选择专家',tool:'选择工具',permission:'任务权限',model:'选择模型',workspace:'选择工作空间'})[key]}</div>{menuChoices[key].map(label=><button role="menuitem" key={label} onClick={()=>{setSelected({...selected,[key]:label});setMenu(null);if(!['permission','model','workspace','mode'].includes(key))notify('已选择 '+label)}}><span>{label}</span>{selected[key]===label&&<Check size={14}/>}</button>)}</div>;
  const send=()=>{if(!draft.trim())return;setMenu(null);onSend?onSend():navigate('task')};
  return <div className={'composer-root '+(home?'composer-home':'composer-session')}>
    {menu&&<div className="composer-menu-dismiss" onClick={()=>setMenu(null)}/>}
    <div className="composer">
      {home&&<img className="composer-robot" src="assets/original/session/composer-robot.svg" alt=""/>}
      {attached&&<div className="composer-attached">{attached}<button aria-label="移除附件" onClick={()=>setAttached('')}><X size={14}/></button></div>}
      <div className="composer-inner">
        <textarea aria-label="任务描述" placeholder="今天帮你做些什么？ @引用对话文件 / 调用技能与指令" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send()}}}/>
        <div className="composer-tools">
          <div className="composer-tools-left">
            <button className="composer-upload" aria-label="添加附件" onClick={()=>upload.current?.click()}><Plus size={16}/></button><input ref={upload} type="file" hidden onChange={e=>setAttached(e.target.files?.[0]?.name||'')}/>
            {!home&&feature('mode','模式',ComposerGlyphMode)}
            {feature('skill','技能',ComposerGlyphSkill)}{feature('expert','专家',ComposerGlyphExpert)}{feature('tool','工具',ComposerGlyphTool)}
            {!home&&feature('permission','默认权限',UserRoundCheck)}
          </div>
          <div className="composer-tools-right"><button aria-label="上下文使用情况" title="上下文使用情况" className="context-usage" onClick={()=>notify('上下文使用量：2%')}><i/></button>{feature('model','自动',ComposerGlyphModel)}<button aria-label="发送" disabled={!draft.trim()} className="composer-send" onClick={send}><img src={COMPOSER_ICONS.send} alt=""/></button></div>
        </div>
      </div>
      {home&&<div className="composer-footer"><div className="composer-feature-wrap"><button onClick={()=>selectMenu('workspace')}><ComposerGlyphWorkspace className="size-4"/>{selected.workspace}<ChevronDown size={14}/></button>{menu==='workspace'&&panel('workspace')}</div><div className="composer-feature-wrap"><button onClick={()=>selectMenu('permission')}><UserRoundCheck size={14}/>{selected.permission}<ChevronDown size={14}/></button>{menu==='permission'&&panel('permission')}</div></div>}
    </div>
  </div>;
}
