import {newConversation,conversationUrl,getConversations,getConversation,useConversations,patchConversation,appendConversationMessage,updateQuerySurface,sendConversationMessage} from './collaboration-store';
import {RefreshCw,SquarePen,LayoutGrid,PanelsTopLeft,ArrowLeft,Folder,List} from 'lucide-react';
import React,{useState,useEffect,useMemo} from 'react';
import {useIdentity,identity} from './local-identity';
import {ownWork} from './member-policy';
import {teamKey,currentTeam,teamUrl} from './team-context';
import {QuerySpec,QuerySurface,createQuerySurface} from './a2ui-query';
import {useWorkspace,getWorkspace} from './multica-ui/store';
import {A2UIProgress} from './a2ui-progress';
import {conversationViews,queryViewId,queryViewTitle} from './view-history';
import {VersionSelect} from './view-preview';
type PinSource={conversationId:string;viewId:string};
type Pin={id:string;title:string;spec:QuerySpec;source?:PinSource};
const key=()=>teamKey('mw-pinned-queries-v1')+':'+identity();
const read=():Pin[]=>{try{return JSON.parse(localStorage.getItem(key())||'[]')}catch{return []}};
function write(pins:Pin[]){localStorage.setItem(key(),JSON.stringify(pins));window.dispatchEvent(new Event('mw-pins'))}
export function usePins(){useIdentity();const [pins,setPins]=useState(read);useEffect(()=>{const sync=()=>setPins(read());window.addEventListener('storage',sync);window.addEventListener('mw-pins',sync);window.addEventListener('mw-identity',sync);window.addEventListener('mw-team-change',sync);return()=>{for(const event of ['storage','mw-pins','mw-identity','mw-team-change'])window.removeEventListener(event,sync)}},[]);return pins}
export function pinQuery(spec:QuerySpec,source?:PinSource){const pins=read(),id=encodeURIComponent(JSON.stringify(spec));const existing=pins.find(p=>p.id===id||source&&p.source?.conversationId===source.conversationId&&p.source?.viewId===source.viewId);if(existing){if(source)write(pins.map(p=>p.id===existing.id?{...p,source}:p));return}write([...pins,{id,title:queryViewTitle(spec),spec,source}])}
export function PinButton({spec,conversationId,viewId}:{spec:QuerySpec;conversationId?:string;viewId?:string}){const pins=usePins(),source=conversationId?{conversationId,viewId:viewId||queryViewId(spec)}:undefined,pinned=pins.some(p=>JSON.stringify(p.spec)===JSON.stringify(spec)||source&&p.source?.conversationId===source.conversationId&&p.source?.viewId===source.viewId);return <button disabled={pinned} onClick={()=>pinQuery(spec,source)}>{pinned?'✓ 已固定':'＋ 固定看板'}</button>}

export function PinnedNav(){
 const pins=usePins(),[expanded,setExpanded]=useState(false),params=new URLSearchParams(location.search);
 const allActive=document.body.dataset.page==='work'&&!params.has('issue')&&!params.has('project')&&!params.has('related')&&(!params.has('view')||params.get('view')==='全部任务');
 const projectsActive=document.body.dataset.page==='work'&&(params.get('view')==='全部项目'||params.has('project'));
 return <section className="co-nav-section" aria-label="看板视图"><header className="co-nav-heading"><span>看板视图</span><a aria-label="浏览全部视图" title="浏览全部视图" href={teamUrl('work.html?view='+encodeURIComponent('全部视图'))}><List size={14}/></a></header>
  <a className={'co-nav-row co-fixed-view '+(allActive?'is-current':'')} href={teamUrl('work.html?view='+encodeURIComponent('全部任务'))} aria-current={allActive?'page':undefined}><LayoutGrid size={15}/><span>全部任务</span></a>
  <a className={'co-nav-row co-fixed-view '+(projectsActive?'is-current':'')} href={teamUrl('work.html?scope=team&view='+encodeURIComponent('全部项目'))} aria-current={projectsActive?'page':undefined}><Folder size={15}/><span>全部项目</span></a>
  {(expanded?pins:pins.slice(0,3)).map(p=><a className={'co-nav-row '+(params.get('board')===p.id?'is-current':'')} key={p.id} href={teamUrl('index.html?board='+encodeURIComponent(p.id))} aria-current={params.get('board')===p.id?'page':undefined}><PanelsTopLeft size={15}/><span>{p.title}</span></a>)}
  {pins.length>3&&<button className="co-nav-more" onClick={()=>setExpanded(!expanded)}>{expanded?'收起':'显示更多（'+(pins.length-3)+'）'}</button>}
 </section>
}

function findSource(pin:Pin,conversations:ReturnType<typeof getConversations>,who:string){
 const allowed=conversations.filter(c=>!c.transient&&c.members.includes(who));
 const source=allowed.find(c=>c.id===pin.source?.conversationId);
 if(source){const view=conversationViews(source,who).find(v=>v.id===pin.source?.viewId);if(view)return {conversation:source,view}}
 const candidates=allowed.flatMap(conversation=>conversationViews(conversation,who).filter(v=>v.versions.some(version=>version.surface.result.spec.kind===pin.spec.kind&&version.surface.result.spec.subject===pin.spec.subject)).map(view=>({conversation,view})));
 return candidates.sort((a,b)=>a.view.versions[0].surface.startedAt-b.view.versions[0].surface.startedAt)[0];
}
export function PinnedBoard(){
 const pins=usePins(),data=useWorkspace(),conversations=useConversations(),who=useIdentity(),pin=pins.find(p=>p.id===new URLSearchParams(location.search).get('board'));
 const source=pin?findSource(pin,conversations,who):undefined;
 const fallback=useMemo(()=>pin?{...createQuerySurface(pin.spec,data,currentTeam()),startedAt:Date.now()-10000}:null,[pin?.id,data]);
 const [selected,setSelected]=useState<string|null>(null),[error,setError]=useState('');
 useEffect(()=>{if(pin&&!pin.source&&source)write(read().map(p=>p.id===pin.id?{...p,source:{conversationId:source.conversation.id,viewId:source.view.id}}:p))},[pin?.id,source?.conversation.id,source?.view.id]);
 const versions=source?.view.versions||[],latest=versions.at(-1),version=versions.find(v=>v.surface.id===selected)||latest,surface=version?.surface||fallback;
 if(!pin||!surface)return <div className="fx-board fx-board-missing"><PanelsTopLeft size={30}/><h2>这个视图已取消固定</h2><a href={teamUrl('index.html')}><ArrowLeft size={14}/>返回会话</a></div>;
 const ensureSource=()=>{
  if(source)return source;
  const conversation=newConversation();patchConversation(conversation.id,{title:'修改视图：'+pin.title});
  appendConversationMessage(conversation.id,{id:crypto.randomUUID(),author:ownWork(),text:'',time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}),kind:'a2ui',surface:{...surface,viewId:queryViewId(surface.result.spec)}});
  const saved=getConversation(conversation.id)!,view=conversationViews(saved,who)[0];
  write(read().map(p=>p.id===pin.id?{...p,source:{conversationId:conversation.id,viewId:view.id}}:p));
  return {conversation:saved,view};
 };
 const edit=()=>{try{const target=ensureSource();location.href=conversationUrl(target.conversation.id)+'&'+new URLSearchParams({view:target.view.id,editView:'1'})}catch{setError('暂时无法打开来源会话，请重试')}};
 const update=(next:QuerySurface)=>{try{const target=ensureSource();updateQuerySurface(target.conversation.id,target.view.versions.at(-1)!.messageId,{...next,viewId:target.view.id});setSelected(null);setError('')}catch{setError('保存新版本失败，请检查浏览器存储空间')}};
 const followup=(text:string)=>{try{const target=ensureSource(),author=target.conversation.messages.find(m=>m.id===target.view.versions.at(-1)!.messageId)?.author;sendConversationMessage(target.conversation.id,(author?'@'+author+' ':'')+text,[],data,{viewContext:target.view.id});location.href=conversationUrl(target.conversation.id)+'&'+new URLSearchParams({view:target.view.id})}catch{setError('暂时无法继续查询，请重试')}};
 return <div className="fx-board fx-versioned-board"><header><div className="fx-board-title"><span><PanelsTopLeft size={16}/>固定视图</span><h2>{source?.view.title||pin.title}</h2></div><div className="fx-board-actions"><button className="fx-edit-view" onClick={edit}><SquarePen size={14}/>修改视图</button><button aria-label="刷新数据并保存新版本" title="刷新数据并保存新版本" onClick={()=>update(createQuerySurface(latest?.surface.result.spec||pin.spec,getWorkspace(),currentTeam()))}><RefreshCw size={17}/></button><button onClick={()=>{write(read().filter(p=>p.id!==pin.id));location.href=teamUrl('index.html')}}>取消固定</button></div></header>
  <div className="fx-board-versionbar"><span><i/> {selected&&version?.surface.id!==latest?.surface.id?'历史版本':'当前最新版'} · v{version?.number||1}</span>{versions.length>0&&<VersionSelect versions={versions} selected={version!.surface.id} onChange={value=>setSelected(value===latest?.surface.id?null:value)}/>}</div>
  {error&&<p role="alert" className="view-error">{error}</p>}
  <A2UIProgress key={surface.id} standalone surface={surface} onUpdate={update} onFollowup={followup}/>
 </div>
}
