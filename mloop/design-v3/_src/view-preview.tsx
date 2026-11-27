import {SidebarResize,useSidebarWidth} from './sidebar-resize';
import React,{useEffect,useRef,useState} from 'react';
import {PanelsTopLeft,RefreshCw,SquarePen,ArrowUpRight,Check,History,Maximize2,Minimize2} from 'lucide-react';
import {Select} from './multica-ui/primitives';
import {A2UIProgress} from './a2ui-progress';
import {PinButton} from './pinned-queries';
import {createQuerySurface,QuerySurface,STREAM_TIMES} from './a2ui-query';
import {getWorkspace} from './multica-ui/store';
import {currentTeam} from './team-context';
import {queryViewSummary,ConversationView,ViewVersion} from './view-history';

const time=(value:string)=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
export function VersionSelect({versions,selected,onChange}:{versions:ViewVersion[];selected:string;onChange:(value:string)=>void}){
 const version=versions.find(v=>v.surface.id===selected)||versions.at(-1)!;
 return <Select label="选择视图版本" className="view-version-select" searchable={versions.length>8} value={version.surface.id} onChange={onChange} options={[...versions].reverse().map((v,i)=>({value:v.surface.id,label:'v'+v.number+(i===0?' · 最新版本':''),description:queryViewSummary(v.surface.result.spec)+' · '+time(v.surface.result.queriedAt)}))}/>;
}
export function ViewMessageCard({view,surface,onOpen}:{view:ConversationView;surface:QuerySurface;onOpen:()=>void}){
 const version=view.versions.find(v=>v.surface.id===surface.id),latest=view.versions.at(-1);
 return <button className="view-message-card" onClick={onOpen}><span className="view-message-icon"><PanelsTopLeft size={21}/></span><span><strong>{view.title}</strong><small>v{version?.number||1} · {queryViewSummary(surface.result.spec)}{surface.id===latest?.surface.id?' · 最新版本':''}</small></span><span className="view-message-open">查看视图<ArrowUpRight size={14}/></span></button>;
}
export function ViewPreview({views,viewId,onViewChange,conversationId,onEdit,onUpdate,onFollowup,selectedVersion,onVersionChange}:{views:ConversationView[];viewId:string;onViewChange:(id:string)=>void;conversationId:string;onEdit:(id:string)=>void;onUpdate:(messageId:string,surface:QuerySurface)=>void;onFollowup:(text:string,viewId:string)=>void;selectedVersion:string|null;onVersionChange:(id:string|null)=>void}){
 const view=views.find(v=>v.id===viewId)||views.at(-1)!;
 const selected=selectedVersion,setSelected=onVersionChange;
 const [expanded,setExpanded]=useState(false),[error,setError]=useState('');
 const sidebar=useSidebarWidth('right');
 const body=useRef<HTMLDivElement>(null),latest=view.versions.at(-1)!,version=view.versions.find(v=>v.surface.id===selected)||latest,historical=version.surface.id!==latest.surface.id;
 useEffect(()=>{setError('')},[view.id]);
 useEffect(()=>{body.current?.scrollTo({top:0})},[version.surface.id]);
 const [clock,setClock]=useState(Date.now());
 const generating=!latest.surface.cancelledAt&&clock-latest.surface.startedAt<STREAM_TIMES.at(-1)!;
 useEffect(()=>{if(!generating)return;const timer=setInterval(()=>setClock(Date.now()),250);return()=>clearInterval(timer)},[latest.surface.id,generating]);
 const update=(next:QuerySurface)=>{try{onUpdate(version.messageId,{...next,viewId:view.id});setSelected(null);setClock(Date.now());setError('')}catch{setError('保存版本失败，请重试')}};
 const refresh=()=>{try{onUpdate(latest.messageId,{...createQuerySurface(latest.surface.result.spec,getWorkspace(),currentTeam()),viewId:view.id,instruction:'重新查询 · '+queryViewSummary(latest.surface.result.spec)});setSelected(null);setClock(Date.now());setError('')}catch{setError('暂时无法重新查询，请重试')}};
 return <aside id="view-preview-sidebar" className={'view-preview '+(expanded?'view-preview-expanded':'')} aria-label="视图预览侧栏" style={sidebar.width?{'--mw-right-sidebar-width':sidebar.width+'px'} as React.CSSProperties:undefined}>
  {!expanded&&<SidebarResize side="right" controls="view-preview-sidebar" {...sidebar}/>}
  <header className="view-preview-header"><span><PanelsTopLeft size={17}/><strong>视图预览</strong><small>{views.length}</small></span><div><button aria-label={expanded?'还原视图预览':'展开视图预览'} title={expanded?'还原宽度':'展开宽度'} onClick={()=>setExpanded(!expanded)}>{expanded?<Minimize2 size={15}/>:<Maximize2 size={15}/>}</button></div></header>
  <div className="view-preview-toolbar"><Select label="选择会话视图" value={view.id} options={views.map(v=>({value:v.id,label:v.title,description:v.versions.length+' 个版本'}))} onChange={onViewChange}/><VersionSelect versions={view.versions} selected={version.surface.id} onChange={value=>setSelected(value===latest.surface.id?null:value)}/></div>
  <div className={'view-revision-info '+(historical?'is-historical':'')}><span>{historical?<History size={13}/>:<Check size={13}/>}<strong>v{version.number}</strong>{historical?'历史版本':generating?'正在生成':'最新版本'}<small>{time(version.surface.result.queriedAt)}</small></span>{historical&&<button onClick={()=>setSelected(null)}>回到最新版<ArrowUpRight size={12}/></button>}</div>
  {error&&<p className="view-error" role="alert">{error}</p>}
  <div className="view-preview-body" ref={body}><A2UIProgress key={version.surface.id} standalone surface={version.surface} onUpdate={update} onFollowup={text=>onFollowup(text,view.id)}/></div>
  <footer className="view-preview-footer"><div><PinButton spec={latest.surface.result.spec} conversationId={conversationId} viewId={view.id}/><button disabled={generating} onClick={refresh} aria-label="重新查询并生成新版本"><RefreshCw size={13}/>重新查询</button></div><button className="view-edit-action" onClick={()=>onEdit(view.id)}><SquarePen size={14}/>在会话中修改</button></footer>
 </aside>;
}
