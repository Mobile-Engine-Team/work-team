import React,{useRef,useState,useEffect} from 'react';
import {Plus,AtSign,ChevronDown,X,Search,UserRoundCheck,Paperclip,LockKeyhole,Monitor,Bot,Users,ListTodo,MoreHorizontal,CornerUpRight} from 'lucide-react';
import {ComposerGlyphModel,ComposerGlyphWorkspace} from '@/react-app/design-system/composer-toolbar-glyphs';
import {COMPOSER_ICONS} from '@/react-app/design-system/composer-icons';
import {isAgent,isSquad,ownWork} from './member-policy';
import {Select,Menu,MenuItem,Popup} from './multica-ui/primitives';
import {currentTeam} from './team-context';
import {readComposerContext} from './composer-policy';
import {allowedComposerConfig,composerRequest,ComposerConfig} from './composer-capabilities';

export function WorkAvatar({name,agent=false}:{name:string;agent?:boolean}){return <span className={'co-avatar '+(agent?'co-bot':'')} data-tone={Array.from(name).reduce((a,c)=>a+c.charCodeAt(0),0)%4}>{agent?<img src="ai-message-avatar.svg" alt=""/>:name.slice(0,1)}</span>}

export function WorkComposer({draft,onChange,onSend,suggestion,home=false,embedded=false,members,candidates,workspace,who,files,setFiles,error,setError,disabled=false,autoFocus=false,focusRequest=0,creationHeader,conversationId='new',transient=false,onDelegateWork,onInvite,onConvertTask}:any){
 const input=useRef<HTMLTextAreaElement>(null),upload=useRef<HTMLInputElement>(null),root=useRef<HTMLDivElement>(null),pickerPanel=useRef<HTMLDivElement>(null),reading=useRef(false);
 const [dismissedSuggestion,setDismissedSuggestion]=useState(false);
 const [picker,setPicker]=useState(''),[query,setQuery]=useState(''),[active,setActive]=useState(0),[target,setTarget]=useState(''),[uploading,setUploading]=useState(false);
 const context=readComposerContext(members,who,draft,workspace),kind=context.kind;
 const suggestedText=home&&kind==='work'&&suggestion&&!draft&&!files.length&&!picker&&!disabled&&!uploading&&!dismissedSuggestion?suggestion.query:'';
 useEffect(()=>setDismissedSuggestion(false),[suggestion?.query,conversationId]);
 useEffect(()=>{if(!focusRequest)return;const node=input.current;node?.focus();node?.setSelectionRange(node.value.length,node.value.length);setPicker('')},[focusRequest]);
 const profile=context.profiles.find(p=>p.name===target)||context.profiles.at(-1);
 const configKey='mw-composer-v2:'+currentTeam().id+':'+who+':'+conversationId;
 const readConfigs=()=>{if(transient)return {};try{const value=JSON.parse(sessionStorage.getItem(configKey)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return {}}};
 const [stored,setStored]=useState<{key:string;values:Record<string,ComposerConfig>}>(()=>({key:configKey,values:readConfigs()}));
 const configs=stored.key===configKey?stored.values:readConfigs();
 const config=profile?allowedComposerConfig(profile,configs[profile.name]||{},workspace):{};
 const rawTail=draft.match(/@([^@]*)$/)?.[1]||'';
 const filtered=candidates.filter((n:string)=>n!==who&&(!query||n.toLowerCase().includes(query.toLowerCase()))&&(picker==='agents'?isAgent(n,workspace):picker==='people'?!isAgent(n,workspace):true)).sort((a:string,b:string)=>Number(members.includes(b))-Number(members.includes(a)));
 useEffect(()=>{setStored({key:configKey,values:readConfigs()});setPicker('');setTarget('')},[configKey]);
 useEffect(()=>{if(autoFocus)input.current?.focus()},[autoFocus]);
 useEffect(()=>{if(draft==='@'){setPicker('all');setQuery('');input.current?.focus()}},[draft]);
 useEffect(()=>{const close=(e:MouseEvent)=>{if(root.current&&!root.current.contains(e.target as Node)&&!pickerPanel.current?.contains(e.target as Node))setPicker('')};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close)},[]);
 const change=(text:string)=>{
  onChange(text);setActive(0);const tail=text.match(/@([^@]*)$/)?.[1];
  const complete=tail!==undefined&&(candidates.some((n:string)=>tail.startsWith(n+' '))||/^Work\s/i.test(tail));
  if(tail!==undefined&&!complete&&!/[\n，。！？,:：!；;]/.test(tail)&&tail.length<35){setPicker('all');setQuery(tail.trim())}else{setPicker('');setQuery('')}
 };
 const pick=(name:string)=>{
  const mention=name===ownWork(who)?'Work':name;
  const hasTail=(rawTail!==''&&rawTail.length<35&&!/[\n，。！？,:：!；;]/.test(rawTail)&&!candidates.some((n:string)=>rawTail.startsWith(n+' '))&&!/^Work\s/i.test(rawTail))||draft.endsWith('@');
  onChange((hasTail?draft.slice(0,draft.lastIndexOf('@')):draft+(draft&&!/\s$/.test(draft)?' ':''))+'@'+mention+' ');
  setTarget(name);setPicker('');setQuery('');input.current?.focus();
 };
 const openPicker=(type:string)=>{setPicker(picker===type?'':type);setQuery('');setActive(0);input.current?.focus()};
 const select=(key:keyof ComposerConfig,value:string)=>{
  if(!profile)return;const next={...configs,[profile.name]:{...config,[key]:value}};setStored({key:configKey,values:next});
  try{if(!transient)sessionStorage.setItem(configKey,JSON.stringify(next))}catch{setError('会话配置暂时无法保存，当前页面仍可使用')}
  input.current?.focus();
 };
 const send=()=>{
  if(disabled||uploading)return;
  const request=composerRequest(context,configs,workspace);
  if(draft.trim()||files.length){onSend(request);setPicker('')}
 };
 const addFiles=async(list:File[])=>{
  if(disabled||reading.current)return;reading.current=true;setUploading(true);
  try{const added=[];for(const f of list){if(f.size>3*1024*1024){setError('单个附件不能超过 3 MB');continue}const url=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('文件读取失败'));reader.readAsDataURL(f)});added.push({name:f.name,url,type:f.type})}setFiles((old:any)=>[...old,...added])}catch{setError('文件读取失败，请重试')}finally{reading.current=false;setUploading(false)}
 };
 const feature=(key:keyof ComposerConfig,label:string,Glyph:any,options:any[],value:string,searchable=true)=><div className={'composer-feature-wrap composer-feature-'+key}><Select label={label} disabled={disabled} value={value} options={options} onChange={(value:string)=>select(key,value)} searchable={searchable} triggerClassName="composer-feature"><Glyph className="size-4"/><span>{value||({workspace:'当前协作空间'})[key]||label}</span><ChevronDown size={12}/></Select></div>;
 const taskAction=onConvertTask&&<button type="button" className="composer-context-action" aria-label="转为任务" disabled={disabled} onClick={onConvertTask}><ListTodo size={15}/><span>转为任务</span></button>;
 const plainHint=kind==='group'?'发送消息，@成员协作，@智能体参与工作':kind==='agent'?'向 '+profile?.name+' 发送消息…':'今天帮你做些什么？ @ 邀请伙伴';
 return <div className={'composer-root mw-collab-composer adaptive-composer '+(home?'composer-home':'composer-session')+(embedded?' composer-compact':'')} data-composer-kind={kind} ref={root} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void addFiles(Array.from(e.dataTransfer.files))}}>
  <div className="composer">{home&&<img className="composer-robot" src="assets/original/session/composer-robot.svg" alt=""/>}<div className="composer-inner">{creationHeader}
   {kind==='agent'&&profile&&<div className="composer-recipient"><div><WorkAvatar name={profile.name} agent/><strong>{profile.name}</strong><span><LockKeyhole size={11}/>沿用智能体配置</span></div><Menu icon={MoreHorizontal} label="更多会话操作"><MenuItem icon={CornerUpRight} onClick={onDelegateWork}>交给 Work</MenuItem><MenuItem icon={Users} onClick={onInvite}>邀请成员</MenuItem>{onConvertTask&&<MenuItem icon={ListTodo} onClick={onConvertTask}>转为任务</MenuItem>}</Menu></div>}
   {kind==='group'&&context.profiles.length>0&&<div className="composer-invoked" aria-label="本条消息调用的智能体"><span>本条调用</span><div>{context.profiles.map(p=><button type="button" aria-label={'配置 '+p.name} aria-pressed={profile?.name===p.name} key={p.name} onClick={()=>{setTarget(p.name);setPicker('')}}><Bot size={13}/>{p.isWork?'Work':p.name}</button>)}</div>{context.profiles.length>1&&<small>分别配置</small>}</div>}
   {!!files.length&&<div className="mw-composer-files">{files.map((f:any,i:number)=><span key={i}><Paperclip size={13}/>{f.name}<button type="button" aria-label={'移除 '+f.name} onClick={()=>setFiles((old:any)=>old.filter((_:any,n:number)=>n!==i))}><X size={12}/></button></span>)}</div>}
   <div className="composer-input-zone"><textarea ref={input} aria-label="会话消息" disabled={disabled} placeholder={suggestedText?'可以试试：'+suggestedText:plainHint} value={draft} onChange={e=>change(e.target.value)} onKeyDown={e=>{if(e.nativeEvent.isComposing)return;if(e.key==='Escape'&&(picker||suggestedText)){setPicker('');if(suggestedText)setDismissedSuggestion(true);e.preventDefault()}else if(picker&&filtered.length&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();setActive((active+(e.key==='ArrowDown'?1:-1)+filtered.length)%filtered.length)}else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(picker&&filtered.length)pick(filtered[active%filtered.length]);else if(!picker)send()}}}/></div>
   <div className="composer-tools"><div className="composer-tools-left">
    <button type="button" className="composer-upload" aria-label="添加附件" disabled={disabled||uploading} onClick={()=>upload.current?.click()}><Plus size={18}/></button>
    {kind!=='agent'&&<button type="button" className="composer-context-action" aria-label={kind==='group'?'提及成员':'提及协作者'} aria-expanded={picker===(kind==='group'?'people':'all')} disabled={disabled} onClick={()=>openPicker(kind==='group'?'people':'all')}><AtSign size={16}/>{kind==='group'&&<span>成员</span>}</button>}
    {kind==='group'&&<button type="button" className="composer-context-action" aria-label="提及智能体" aria-expanded={picker==='agents'} disabled={disabled} onClick={()=>openPicker('agents')}><Bot size={16}/><span>智能体</span></button>}
    {(kind==='work'||kind==='group'&&!profile)&&taskAction}
   </div><div className="composer-tools-right">{suggestedText&&<button type="button" className="composer-fill-suggestion" title="仅填入草稿，不会发送" onClick={()=>{change(suggestedText);setDismissedSuggestion(true);input.current?.focus()}}>填入建议</button>}
    {kind==='group'&&profile&&onConvertTask&&<Menu label="消息更多操作"><MenuItem icon={ListTodo} onClick={onConvertTask}>转为任务</MenuItem></Menu>}
    <button type="button" aria-label="发送消息" className="composer-send" disabled={disabled||uploading||(!draft.trim()&&!files.length)} onClick={send}><img src={COMPOSER_ICONS.send} alt=""/></button>
   </div></div>
  </div>
  {profile?.isWork&&<div className="composer-footer adaptive-work-footer">{feature('workspace','工作空间',ComposerGlyphWorkspace,[{value:'',label:'当前协作空间'},...workspace.projects.map((p:any)=>p.name)],config.workspace||'')}{feature('permission','执行权限',UserRoundCheck,['默认权限','完全访问'],config.permission||'默认权限',false)}</div>}
  {profile&&!profile.isWork&&<div className="composer-agent-meta"><span title={'模型：'+profile.model}><ComposerGlyphModel className="size-4"/>{profile.model}<LockKeyhole size={10}/></span><span title={'运行环境：'+profile.runtime}><Monitor size={13}/>{profile.runtime}<LockKeyhole size={10}/></span>{kind==='group'&&<span className="composer-meta-note">仅应用于 {profile.name}</span>}</div>}
  </div>

  <input ref={upload} type="file" multiple hidden onChange={e=>{void addFiles(Array.from(e.target.files||[]));e.target.value=''}}/>
  {picker&&<Popup anchor={root} onClose={()=>setPicker('')} label="提及成员、智能体或小队" width={Math.min(360,window.innerWidth-32)}><div ref={pickerPanel} className="mw-member-picker composer-adaptive-picker"><header><Search size={15}/><input aria-label="搜索协作者" placeholder="搜索成员、智能体与小队" value={query} onChange={e=>{setQuery(e.target.value);setActive(0)}}/><button type="button" aria-label="关闭成员选择" onClick={()=>setPicker('')}><X size={15}/></button></header><div className="composer-picker-tabs">{[['all','全部'],['people','成员'],['agents','智能体']].map(([id,label])=><button type="button" key={id} aria-pressed={picker===id} onClick={()=>{setPicker(id);setActive(0)}}>{label}</button>)}</div><div className="mw-member-options" role="listbox" aria-label="协作者">{filtered.map((n:string,i:number)=><button type="button" role="option" aria-selected={active===i} key={n} onMouseEnter={()=>setActive(i)} onClick={()=>pick(n)}><WorkAvatar name={n} agent={isAgent(n,workspace)}/><span>{n===ownWork(who)?'Work · 我的助手':n}<small>{members.includes(n)?'已在会话':n===ownWork(who)?'我的 Work 助手 · 邀请加入':isSquad(n,workspace)?'小队 · 邀请全队加入':isAgent(n,workspace)?'智能体 · 邀请加入':'发送后邀请加入'}</small></span>{active===i&&<AtSign size={14}/>}</button>)}{!filtered.length&&<p>没有可提及的协作者</p>}</div><footer>发送后邀请加入 · 其他成员的 Work 助手需由本人邀请</footer></div></Popup>}
  {uploading&&<p className="composer-upload-status" role="status">正在添加附件…</p>}
  {error&&<p className="co-error" role="alert">{error}</p>}
 </div>
}
