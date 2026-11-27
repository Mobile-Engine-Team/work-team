import {SidebarResize,useSidebarWidth} from './sidebar-resize';
import {PinnedNav} from './pinned-queries';
import {GlobalSearch} from './workspace-search';
import {InvitationReceiver} from './invitation-flow';
import './workspace-features.css';
import {UpgradeWalkthrough} from './upgrade-walkthrough';
import {ProactiveInsights} from './proactive-insights';
import {NotificationCenter} from './notification-center';
import {collectNotices,useReadVersion} from './notifications';
import './notifications.css';
import {useIdentity,openSettings,setIdentity,DEFAULT_LOCAL_IDENTITY} from './local-identity';
import {INVITATION_TEST_MEMBERS} from './invitation-test-members';
import {useConversations,conversationUrl} from './collaboration-store';
import {MessageSquare,Link2,Settings,ArrowUpRight,ClipboardList,UserRoundCog} from 'lucide-react';
import {TeamSwitcher} from './team-switcher';
import {useTeam,teamUrl} from './team-context';
import {activeAgents,chatUrl,openAgentChat,useAgentChats} from './agent-chat-store';
import React, {useState, useRef} from 'react';
import {Plus, PlusCircle, ChevronDown, ChevronRight, X, UserRoundCheck, Check, Folder, Search, Bot, Users, Network} from 'lucide-react';
import {ComposerGlyphSkill, ComposerGlyphExpert, ComposerGlyphTool, ComposerGlyphWorkspace} from '@/react-app/design-system/composer-toolbar-glyphs';
import {ExpertTeamGlyph, AutomationGlyph} from '@/react-app/design-system/mw-glyphs';
import {SidebarCollapseIcon, SidebarSearchIcon} from '@/react-app/domains/shared/sidebar-brand-icons';
import {AccountAvatar} from '@/react-app/design-system/account-avatar';
import {COMPOSER_ICONS} from '@/react-app/design-system/composer-icons';
import {ListTodo as MulticaWork} from './multica-icons';
import {useWorkspace} from './multica-ui/store';
import {IssueStatusIcon} from './multica-ui/issue-status-icon';
import {Modal,Select as TaskSelect} from './multica-ui/primitives';
import {useBoard,getSettings,filterIssues} from './multica-ui/board-model';
import {isRelatedIssue} from './multica-ui/store';

export const SAMPLE_TITLE='持续求解 P=NP 千禧年难题';
export const notify=(text:string)=>window.dispatchEvent(new CustomEvent('design-toast',{detail:text}));
const navigate=(name:string)=>location.href=name+'.html';
export const taskNames=[SAMPLE_TITLE,'整理工作笔记','浏览器控制能力询问','Show current working directory','询问模型身份','整理本周会议纪要与待办事项','AI Agent 产品对比研究','制作项目进展汇报 PPT','生成月度经营分析报告'];
export const sessionNames=['测试群聊','产品评审群','设计走查','研发同步','客户交付沟通'];

export function Shell({children}){
 const sidebar=useSidebarWidth('left');
 const [globalSearch,setGlobalSearch]=useState(false);React.useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setGlobalSearch(true)}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[]);const who=useIdentity();const page=document.body.dataset.page||'index',team=useTeam(),data=useWorkspace(),conversations=useConversations().filter(c=>!c.transient&&!c.sourceConversationId),chats=[];
 useReadVersion();
 const notices=collectNotices(data,conversations,who,chats,Object.fromEntries(activeAgents().map(a=>[a.id,a.name]))),unread=notices.filter(n=>!n.read);
 const unreadFor=(id:string)=>unread.filter(n=>n.source===id);
 const params=new URLSearchParams(location.search);
 const [,refreshRoute]=useState(0);React.useEffect(()=>{const refresh=()=>refreshRoute(n=>n+1);window.addEventListener('mw-board-route',refresh);window.addEventListener('popstate',refresh);return()=>{window.removeEventListener('mw-board-route',refresh);window.removeEventListener('popstate',refresh)}},[]);
 const [collapsed,setCollapsed]=useState(()=>window.innerWidth<=760),[account,setAccount]=useState(false),[identityPicker,setIdentityPicker]=useState(false),[query,setQuery]=useState('');
 React.useEffect(()=>{const media=window.matchMedia('(max-width:760px)');const resize=()=>{if(media.matches)setCollapsed(true)};media.addEventListener('change',resize);return()=>media.removeEventListener('change',resize)},[]);
 const accountEntry=useRef<HTMLButtonElement>(null);
 const q=query.trim().toLowerCase();
 const [recentExpanded,setRecentExpanded]=useState(false),[folders,setFolders]=useState<Record<string,boolean>>({}),[folderMore,setFolderMore]=useState<Record<string,boolean>>({});
 const liveIssues=data.issues.filter(i=>!i.archived);
 const conversationProject=(c:any)=>c.project||liveIssues.find(i=>c.issues.includes(i.id))?.project||'';
 const recent=[...conversations.filter(c=>c.members.includes(who)).map(c=>({id:'conversation:'+c.id,title:c.title,href:conversationUrl(c.id),active:page==='index'&&params.get('conversation')===c.id,kind:'chat',updated:c.updatedAt||c.createdAt||''}))].sort((a,b)=>b.updated.localeCompare(a.updated)).filter(c=>!q||c.title.toLowerCase().includes(q));
 const relevant=liveIssues.filter(i=>unreadFor('issue:'+i.id).length||((i.assignee===who)||(who==='肖叶茂'&&isRelatedIssue(i,data)))||conversations.some(c=>c.issues.includes(i.id)&&c.members.includes(who)));
 const projectNames=[...new Set([...relevant.map(i=>i.project||'未关联项目'),...conversations.filter(c=>c.members.includes(who)&&conversationProject(c)).map(c=>conversationProject(c))])];
 const projectGroups=projectNames.map(project=>{
 const issues=relevant.filter(i=>(i.project||'未关联项目')===project);
 const linked=conversations.filter(c=>c.members.includes(who)&&(conversationProject(c)||'未关联项目')===project&&(c.project||c.issues.some(id=>issues.some(i=>i.id===id))));
 const rows=[...issues.map(i=>({id:'issue:'+i.id,title:i.title,href:teamUrl('work.html?issue='+i.id),active:page==='work'&&Number(params.get('issue'))===i.id,status:i.status,kind:'task'})),...linked.map(c=>({id:'conversation:'+c.id,title:c.title,href:conversationUrl(c.id),active:page==='index'&&params.get('conversation')===c.id,status:'',kind:'chat'}))].filter(r=>!q||project.toLowerCase().includes(q)||r.title.toLowerCase().includes(q));
 rows.sort((a,b)=>Number(b.kind==='chat')-Number(a.kind==='chat'));return {project,rows};}).filter(g=>g.rows.length);
 const row=(item:any,nested=false)=>{const pending=unreadFor(item.id),tag=pending.some(n=>n.kind==='mention')?'@':pending.some(n=>n.kind==='task'||n.kind==='assignment')?'新':'';return <a key={item.id} href={item.href} title={item.title+(pending.length?' · '+pending.length+' 条未读':'')} aria-label={item.title+(pending.length?'，'+pending.length+' 条未读':'')} aria-current={item.active?'page':undefined} className={'co-nav-row '+(pending.length?'has-unread ':'')+(nested?'co-nav-nested ':'')+(item.active?'is-current':'')}>{item.kind==='task'?<IssueStatusIcon status={item.status}/>:<MessageSquare size={14}/>}<span>{item.title}</span>{tag&&<em className="mw-nav-tag">{tag}</em>}{pending.length>0&&<b className="mw-unread-count">{pending.length>99?'99+':pending.length}</b>}</a>};

 return <div className={'design-shell desktop-mac collaboration-shell '+(collapsed?'hide-sidebar':'')} style={sidebar.width?{'--mw-left-sidebar-width':sidebar.width+'px'} as React.CSSProperties:undefined}>
 <div className="mac-traffic" aria-hidden="true"><i/><i/><i/></div>
 <aside id="workspace-sidebar" className="design-sidebar">
 <div className="mac-sidebar-controls"><button aria-label="搜索会话与任务" onClick={()=>setGlobalSearch(true)}><SidebarSearchIcon className="size-4"/></button><button aria-label="收起侧栏" onClick={()=>setCollapsed(true)}><SidebarCollapseIcon className="size-4"/></button></div>
 <div className="sidebar-team-context"><TeamSwitcher/></div>
 <div className="sidebar-new-task co-new-wrap"><button onClick={()=>location.href=teamUrl('index.html?start=chat')}><PlusCircle size={18}/>新建</button></div>
 <nav className="co-primary-nav" aria-label="空间导航">{[['space','协作空间',Users],['agents','智能体',Bot],['squads','智能体小队',Network]].map(([id,label,Icon]:any)=>{const active=page===id||id==='space'&&page==='settings-runtimes';return <a key={id} className={'co-primary-link '+(active?'is-current':'')} aria-current={active?'page':undefined} href={teamUrl(id+'.html')}><Icon size={16}/><span>{label}</span></a>})}</nav>

 <div className="sidebar-regions co-navigation">
 <section className="co-nav-section" aria-label="最近会话"><header className="co-nav-heading"><span>最近会话</span></header>
 <div>{(recentExpanded||q?recent:recent.slice(0,5).concat(recent.slice(5).filter(r=>r.active||unreadFor(r.id).length))).map(c=>row(c))}</div>
 {!q&&recent.length>5&&<button className="co-nav-more" onClick={()=>setRecentExpanded(!recentExpanded)}>{recentExpanded?'收起':'查看全部会话'}<ChevronDown size={12} style={recentExpanded?{transform:'rotate(180deg)'}:undefined}/></button>}
 {!recent.length&&<p className="co-nav-empty">没有匹配的会话</p>}</section>
 <PinnedNav/><section className="co-nav-section co-related" aria-label="与我有关"><header className="co-nav-heading"><span>与我有关</span></header>
 {projectGroups.map(({project,rows})=>{const folderKey=team.id+':'+project,open=!!q||folders[folderKey]!==false,expanded=!!q||folderMore[folderKey],visible=expanded?rows:rows.slice(0,4).concat(rows.slice(4).filter(r=>r.active||unreadFor(r.id).length));return <div className="co-project-group" key={folderKey}><button className="co-project-toggle" aria-expanded={open} aria-label={(open?'收起项目 ':'展开项目 ')+project} onClick={()=>setFolders({...folders,[folderKey]:!open})}><ChevronRight size={12} className={open?'is-open':''}/><Folder size={15}/><span>{project}</span><small className={rows.some(r=>unreadFor(r.id).length)?'mw-folder-unread':''}>{rows.some(r=>unreadFor(r.id).length)?rows.reduce((n,r)=>n+unreadFor(r.id).length,0)+' 未读':rows.length}</small></button>{open&&<div className="co-project-items">{visible.map(item=>row(item,true))}{rows.length>4&&<button className="co-nav-more co-nested-more" onClick={()=>setFolderMore({...folderMore,[folderKey]:!expanded})}>{expanded?'收起':'查看其余 '+(rows.length-4)+' 条'}<ChevronDown size={11} style={expanded?{transform:'rotate(180deg)'}:undefined}/></button>}</div>}</div>})}
 {!projectGroups.length&&<p className="co-nav-empty">{q?'没有匹配的项目或会话':'与你有关的会话会按项目收纳在这里'}</p>}
 </section></div>
 <footer className="sidebar-account co-account" onKeyDown={e=>{if(e.key==='Escape'&&account){e.stopPropagation();setAccount(false);accountEntry.current?.focus()}}}>
  <button ref={accountEntry} className="account-entry" aria-label="账户菜单" aria-expanded={account} onClick={()=>setAccount(!account)}><AccountAvatar size={32} glyph={who.slice(0,1)} tone="brand"/><span>{who}</span><ChevronRight size={14}/></button>
  {account&&<><div className="co-dismiss" onClick={()=>setAccount(false)}/><div className="account-popover"><div className="account-popover-user"><AccountAvatar size={32} glyph={who.slice(0,1)} tone="brand"/><span>{who}</span></div><div className="sidebar-rule"/><button className="co-account-settings" onClick={()=>{accountEntry.current?.focus();setAccount(false);setIdentityPicker(true)}}>切换当前用户<UserRoundCog size={15}/></button><button className="co-account-settings" onClick={()=>{setAccount(false);openSettings()}}>设置<Settings size={15}/></button><a href={teamUrl('settings-help.html')}>帮助与反馈<ChevronRight size={14}/></a></div></>}
 </footer>
 <SidebarResize side="left" controls="workspace-sidebar" {...sidebar}/>
 </aside><main className="design-pane"><div className="design-titlebase"><button className="desktop-nav-toggle" aria-label="展开侧栏" onClick={()=>setCollapsed(false)}><SidebarCollapseIcon className="size-4 -scale-x-100"/></button><div className="mw-title-actions"><span className="mac-version"><i/>MW-V1.0.1</span><NotificationCenter notices={notices}/></div></div><div className="design-panel">{children}</div></main>


 {identityPicker&&<LocalIdentityPicker who={who} members={data.members} onClose={()=>setIdentityPicker(false)}/>}
 {globalSearch&&<GlobalSearch onClose={()=>setGlobalSearch(false)}/>}<InvitationReceiver/><ProactiveInsights/><UpgradeWalkthrough/> </div>
}

function LocalIdentityPicker({who,members,onClose}:{who:string;members:{name:string;email?:string}[];onClose:()=>void}){
 const people=new Map<string,{name:string;detail:string}>();
 people.set(DEFAULT_LOCAL_IDENTITY,{name:DEFAULT_LOCAL_IDENTITY,detail:'默认身份'});
 for(const member of members){
  const fixture=INVITATION_TEST_MEMBERS.find(m=>m.email===member.email);
  if(member.name!==DEFAULT_LOCAL_IDENTITY)people.set(member.name,{name:fixture?.name||member.name,detail:member.email||'团队成员'});
 }
 for(const fixture of INVITATION_TEST_MEMBERS){
  if(!members.some(m=>m.email===fixture.email||m.name===fixture.email))people.set(fixture.email,{name:fixture.name,detail:fixture.email+' · 测试身份'});
 }
 if(!people.has(who))people.set(who,{name:who,detail:'本地身份'});
 return <Modal title="切换当前用户" className="co-identity-dialog" onClose={onClose}>
  <p>仅切换当前标签页的本地测试身份，不会自动加入团队。</p>
  <div className="co-identity-list">{[...people].map(([id,{name,detail}])=><button type="button" key={id} aria-current={id===who?'true':undefined} onClick={()=>{if(id!==who){setIdentity(id);notify('已切换为 '+name)}onClose()}}>
   <AccountAvatar size={32} glyph={name.slice(0,1)} tone="brand"/><span><strong>{name}</strong><small>{detail}</small></span>{id===who&&<em><Check size={14}/>当前</em>}
  </button>)}</div>
 </Modal>;
}

const menuChoices={permission:['默认权限','完全访问'],workspace:['日常办公','每日 AI 新闻推送']};

export function Composer({draft,setDraft,home=false,onSend}){
  const [menu,setMenu]=useState<string|null>(null),[selected,setSelected]=useState<Record<string,string>>({permission:'默认权限',workspace:'日常办公'}),[attached,setAttached]=useState('');
  const upload=useRef<HTMLInputElement>(null);
  const selectMenu=(key:string)=>setMenu(menu===key?null:key);
  const glyph=(Glyph)=> <Glyph className="size-4"/>;
  const feature=(key:string,label:string,Glyph)=> <div className={'composer-feature-wrap composer-feature-'+key} key={key}><button aria-label={label} aria-expanded={menu===key} className={'composer-feature '+(menu===key?'is-open':'')} onClick={()=>selectMenu(key)}>{glyph(Glyph)}<span>{['permission'].includes(key)?selected[key]:label}</span><ChevronDown size={15}/></button>{menu===key&&panel(key)}</div>;
  const panel=(key:string)=><div role="menu" className="composer-menu"><div className="composer-menu-title">{({permission:'任务权限',workspace:'选择工作文件夹'})[key]}</div>{menuChoices[key].map(label=><button role="menuitem" key={label} onClick={()=>{setSelected({...selected,[key]:label});setMenu(null);if(!['permission','model','workspace','mode'].includes(key))notify('已选择 '+label)}}><span>{label}</span>{selected[key]===label&&<Check size={14}/>}</button>)}</div>;
  React.useEffect(()=>{if(home&&new URLSearchParams(location.search).get('start')==='chat')document.querySelector<HTMLTextAreaElement>('textarea[aria-label="任务描述"]')?.focus()},[home]);
  const send=()=>{if(!draft.trim())return;setMenu(null);onSend?onSend():navigate('task')};
  return <div className={'composer-root '+(home?'composer-home':'composer-session')}>
    {menu&&<div className="composer-menu-dismiss" onClick={()=>setMenu(null)}/>}
    <div className="composer">
      {home&&<img className="composer-robot" src="assets/original/session/composer-robot.svg" alt=""/>}
      {attached&&<div className="composer-attached">{attached}<button aria-label="移除附件" onClick={()=>setAttached('')}><X size={14}/></button></div>}
      <div className="composer-inner">
        <textarea aria-label="任务描述" placeholder="今天帮你做些什么？ @引用对话文件" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send()}}}/>
        <div className="composer-tools">
          <div className="composer-tools-left">
            <button className="composer-upload" aria-label="添加附件" onClick={()=>upload.current?.click()}><Plus size={16}/></button><input ref={upload} type="file" hidden onChange={e=>setAttached(e.target.files?.[0]?.name||'')}/>
            {!home&&feature('permission','默认权限',UserRoundCheck)}
          </div>
          <div className="composer-tools-right"><button aria-label="上下文使用情况" title="上下文使用情况" className="context-usage" onClick={()=>notify('上下文使用量：2%')}><i/></button><button aria-label="发送" disabled={!draft.trim()} className="composer-send" onClick={send}><img src={COMPOSER_ICONS.send} alt=""/></button></div>
        </div>
      </div>
      {home&&<div className="composer-footer"><div className="composer-feature-wrap"><button aria-label="选择工作文件夹" onClick={()=>selectMenu('workspace')}><ComposerGlyphWorkspace className="size-4"/>工作文件夹：{selected.workspace}<ChevronDown size={14}/></button>{menu==='workspace'&&panel('workspace')}</div><div className="composer-feature-wrap"><button onClick={()=>selectMenu('permission')}><UserRoundCheck size={14}/>{selected.permission}<ChevronDown size={14}/></button>{menu==='permission'&&panel('permission')}</div></div>}
    </div>
  </div>;
}
