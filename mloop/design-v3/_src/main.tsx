import {teamUrl} from './team-context';
import {PinnedBoard} from './pinned-queries';
import {migrateConversations,resolveAgentConversation,resolveGroupConversation} from './conversation-bridge';
import './demo-runtime';
import {useIdentity} from './local-identity';
import {CollaborationSettings} from './collaboration-settings';
import {SpaceOverview} from './space-overview';
import {Collaboration} from './collaboration';
import {GroupChat} from './group-chat';
import {Shell,Composer} from './chrome';
import './agent-workspace.js';
import './agent-workspace.css';
import {WorkspaceTabs as TopTabs} from './workspace-tabs';
import {Task} from './task';
import {LocalFiles} from './local-files';
import {SettingsContent} from './local-settings';
import {AgentChat} from './agent-chat';
import {BoardTaskForm} from './multica-ui/board-task-form';

import {DaemonSettings,RuntimeSettings} from './multica-ui/runtime-settings';
import {Server as RuntimeSettingsIcon} from './multica-icons';
import {WorkPage} from './multica-ui/work';
import './multica.css';
import './work-board.css';
import './task-create.css';
import {cn} from '@/lib/utils';
const FONT_SIZE_TIERS=['small','default','large'];
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {TooltipProvider} from '@/components/ui/tooltip';
import {MwPageTitle,MwCardRow,MwButton,MwSelect,MwSwitch,MwInfoCell,MwActionRow} from '@/react-app/domains/settings/mobilework/kit';
import {getMwSettingsSections} from '@/react-app/domains/settings/mobilework/sections';
import {WELCOME_SCENES} from '@/react-app/domains/session/surface/welcome-presets';
import {initLocale,t} from '@/i18n';
import {Plus,PlusCircle,Search,SlidersHorizontal,PanelLeftClose,PanelLeft,ChevronDown,ChevronLeft,ChevronRight,Check,Settings,MoreHorizontal,Folder,FolderOpen,FileText,Paperclip,Sparkles,ArrowUp,Mic,ShieldCheck,Users,Plug,Zap,Download,Layers,Store,Upload,X,ListChecks,Play,Clock,CalendarDays,Trash2,SquarePen,ExternalLink,Sun,Moon,Monitor,RefreshCw} from 'lucide-react';
import './design.css';
import './calibration.css';
import './interaction-polish.css';
import './collaboration.css';
import './task-composer.css';
import './view-preview.css';
import './adaptive-composer.css';
initLocale();
migrateConversations();
const legacyParams=new URLSearchParams(location.search);
if(document.body.dataset.page==='agents'&&legacyParams.get('chat')==='1'){if(resolveAgentConversation(legacyParams))document.body.dataset.page='index'}
if(document.body.dataset.page==='group-chat'){if(resolveGroupConversation(legacyParams))document.body.dataset.page='index'}
window.addEventListener('mw-team-change',migrateConversations);
const page=document.body.dataset.page||'index';
const retired=/^(?:automation(?:-|$)|skills?(?:-|$)|(?:my-)?(?:experts|tools)$)/.test(page);
const go=(name)=>location.href=name+'.html';
const asset=(name)=>'assets/original/'+name;
const IBASE='expert-workspace-icons/';
const titles={index:'会话',task:'工作任务',skills:'技能市场','skills-installed':'已安装技能','skill-detail':'技能详情',experts:'专家','my-experts':'我的专家',tools:'工具市场','my-tools':'我的工具',automation:'定时任务','automation-empty':'定时任务','automation-runs':'运行记录','automation-create':'新建定时任务',files:'我的文件'};
function toast(text){window.dispatchEvent(new CustomEvent('design-toast',{detail:text}));}
function Icon({icon:Icon,size=16}){return typeof Icon==='string'?<span style={{width:size,height:size,display:'inline-block',background:'currentColor',maskImage:`url(${Icon})`,maskSize:'contain',maskRepeat:'no-repeat',maskPosition:'center'}}/>:<Icon size={size}/>}
function Home(){const[scene,setScene]=useState(0),[draft,setDraft]=useState('');return <div className="design-home"><div className="home-center"><div className="home-content"><div className="flex items-center gap-5"><img src="welcome-brand-mark.svg" className="size-14" alt=""/><h1 className="text-[32px] font-semibold leading-[40px] text-[var(--mw-welcome-title)]">Mobile熠动，Work智简</h1></div><div className="home-scenes mt-4 inline-flex items-center gap-2 rounded-full p-2 bg-[var(--mw-welcome-scene-rail)]">{WELCOME_SCENES.map((s,i)=><button className={'flex h-[42px] items-center gap-2 rounded-full px-4 text-[16px] leading-6 '+(scene===i?'bg-[var(--mw-welcome-tab-active-bg)] text-[var(--mw-brand)] font-medium shadow-[var(--mw-welcome-tab-shadow)]':'text-[var(--mw-gray-2)]')} key={s.key} onClick={()=>setScene(i)}><Icon icon={s.icon} size={18}/>{s.label}</button>)}</div><div className="hero-actions">{WELCOME_SCENES[scene].actions.map(a=><button className="hero-chip" key={a.label} onClick={()=>setDraft(a.prompt)}><Icon icon={a.icon}/>{a.label}</button>)}</div><div className="mt-3.5"><Composer home draft={draft} setDraft={setDraft}/></div></div></div></div>}
function ThemeSegmented(props: {
  value: string;
  onChange: (next: string) => void;
}) {
  const options: Array<{ value: string; label: string }> = [
    { value: "light", label: t("mw_settings.system.theme_light") },
    { value: "dark", label: t("mw_settings.system.theme_dark") },
    { value: "system", label: t("mw_settings.system.theme_system") },
  ];

  return (
    <div className="inline-flex h-[38px] w-[196px] items-center gap-1 rounded-[3px] bg-[var(--mw-gray-8)] p-1 dark:rounded-[4px] dark:bg-[var(--mw-settings-nav-surface)]">
      {options.map((option) => {
        const active = option.value === props.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => props.onChange(option.value)}
            className={cn(
              "h-[30px] w-[60px] rounded-[4px] text-[14px] font-normal leading-[22px] transition-colors",
              active
                ? "bg-[var(--mw-surface)] text-[var(--mw-gray-1)] dark:bg-[var(--mw-settings-nav-active)] dark:text-[var(--mw-workspace-tab-active-fg)]"
                : "text-[var(--mw-gray-2)] hover:text-[var(--mw-gray-1)] dark:text-[var(--mw-welcome-subtitle)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function FontSizeControl(props: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="relative h-[126px] border-b border-[var(--mw-gray-7)]">
      <div className="flex flex-col gap-2">
        <span className="text-[16px] font-medium leading-6 text-[var(--mw-gray-1)]">
          {t("mw_settings.system.font_size")}
        </span>
        <span className="text-[14px] font-normal leading-[22px] text-[var(--mw-gray-3)]">
          调整本设备的会话正文显示字号。
        </span>
      </div>
      <input
        aria-label={t("mw_settings.system.font_size")}
        type="range"
        min={0}
        max={2}
        step={1}
        value={FONT_SIZE_TIERS.indexOf(props.value)}
        onChange={(event) => props.onChange(FONT_SIZE_TIERS[event.currentTarget.valueAsNumber] ?? "default")}
        className={cn(
          "mw-font-size-slider absolute left-0 top-[59px] w-full",
          props.value === "small" && "[--mw-slider-progress:0%]",
          props.value === "default" && "[--mw-slider-progress:50%]",
          props.value === "large" && "[--mw-slider-progress:100%]",
        )}
      />
      <button type="button" onClick={() => props.onChange("small")} className="absolute left-0 top-[86px] text-[14px] font-normal leading-[22px] text-[var(--mw-gray-3)]">
        {t("mw_settings.system.font_small")}12
      </button>
      <button type="button" onClick={() => props.onChange("default")} className="absolute left-1/2 top-[86px] -translate-x-1/2 text-[14px] font-normal leading-[22px] text-[var(--mw-gray-3)]">
        {t("mw_settings.system.font_default")}14
      </button>
      <button type="button" onClick={() => props.onChange("large")} className="absolute right-0 top-[86px] text-[14px] font-normal leading-[22px] text-[var(--mw-gray-3)]">
        {t("mw_settings.system.font_large")}18
      </button>
    </div>
  );
}


function SettingsPage({onClose,conversation}:{onClose?:()=>void;conversation?:string}={}){
 const [selected,setSelected]=useState(conversation?'collaboration':onClose?'account':page.replace('settings-',''));const closeSettings=()=>onClose?onClose():go('index');
 const section=selected,runtimeSection=section==='daemon'||section==='runtimes';
 const sections=[...(conversation?[{key:'collaboration',label:'会话设置',icon:RuntimeSettingsIcon}]:[]),...getMwSettingsSections().filter(s=>s.key!=='runtimes')];
 React.useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!e.defaultPrevented&&!document.querySelector('.mc-overlay,[data-mc-popup]'))closeSettings()};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[]);
 const content=section==='collaboration'?<CollaborationSettings conversation={conversation}/>:section==='daemon'?<DaemonSettings/>:section==='runtimes'?<RuntimeSettings/>:<SettingsContent section={section} FontSizeControl={FontSizeControl} ThemeSegmented={ThemeSegmented}/>;
 return <>{!onClose&&<Home/>}<div className="settings-overlay"><section className={'settings-dialog '+(runtimeSection?'settings-runtime-dialog':'')+(section==='daemon'?' settings-daemon-dialog':'')} role="dialog" aria-modal="true" aria-label="设置"><div className="settings-nav-bg"/><header className="settings-header"><h2 className="text-[20px] font-medium leading-7">设置</h2><button aria-label="关闭设置" onClick={closeSettings}><X size={17}/></button></header><nav className="settings-nav" aria-label="设置菜单">{sections.map(s=><a href={'settings-'+(s.key==='collaboration'?'system':s.key)+'.html'} onClick={e=>{e.preventDefault();setSelected(s.key)}} key={s.key} aria-current={s.key===section?'page':undefined} className={s.key===section?'active':''}><s.icon className="size-4 shrink-0"/><span>{s.label}</span></a>)}</nav><div className="settings-divider"/><main className={'settings-body '+(runtimeSection?'settings-runtime-body':'')+(section==='daemon'?' settings-daemon-body':'')}>{content}</main></section></div></>
}
function App(){React.useEffect(()=>{const open=()=>location.href=teamUrl('space.html');window.addEventListener('mw-open-collaboration-space',open);return()=>window.removeEventListener('mw-open-collaboration-space',open)},[]);const[settingsContext,setSettingsContext]=useState<any>(null);React.useEffect(()=>{const open=(e:any)=>setSettingsContext(e.detail||{});window.addEventListener('mw-open-settings',open);return()=>window.removeEventListener('mw-open-settings',open)},[]);const[assignedTask,setAssignedTask]=useState<any>(null);React.useEffect(()=>{const create=(e:any)=>setAssignedTask(e.detail);window.addEventListener('design-create-board-task',create);return()=>window.removeEventListener('design-create-board-task',create)},[]);const[msg,setMsg]=useState('');React.useEffect(()=>{const fn=e=>{setMsg(e.detail);setTimeout(()=>setMsg(''),2500)};window.addEventListener('design-toast',fn);return()=>window.removeEventListener('design-toast',fn)},[]);let content=page==='space'||page==='settings-runtimes'?<SpaceOverview/>:page==='agents'&&new URLSearchParams(location.search).get('chat')==='1'?<AgentChat/>:['agents','squads'].includes(page)?React.createElement('agent-workspace'):page==='work'?<WorkPage/>:page==='index'?(new URLSearchParams(location.search).has('board')?<PinnedBoard/>:<Collaboration/>):page==='task'?<Task/>:page==='group-chat'?<GroupChat/>:page.startsWith('settings-')?<SettingsPage/>:page==='files'?<LocalFiles/>:<Collaboration/>;return <TooltipProvider><Shell>{content}</Shell>{settingsContext&&<SettingsPage conversation={settingsContext.conversation} onClose={()=>setSettingsContext(null)}/>}{assignedTask&&<BoardTaskForm initial={assignedTask.initial} onClose={()=>setAssignedTask(null)} onCreated={assignedTask.onCreated}/>}{msg&&<div role="status" className="toast"><Check className="inline mr-2 text-[var(--mw-success-normal)]" size={16}/>{msg}</div>}</TooltipProvider>}
if(retired)location.replace(teamUrl('index.html'));
else createRoot(document.getElementById('root')).render(<App/>);
