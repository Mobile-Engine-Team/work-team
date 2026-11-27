import React,{useEffect,useRef,useState} from 'react';
import {MessageSquare,ListTodo,Paperclip,X,ChevronDown,UserRound,Flag,Tag,Folder,Bot,Check,ArrowUpRight,ArrowLeftRight} from 'lucide-react';
import {Select} from './multica-ui/primitives';
import {boardStatuses,BoardIssue} from './multica-ui/board-model';
import {createIssue,priorities,issueUrl} from './multica-ui/store';
import {IssueStatusIcon} from './multica-ui/issue-status-icon';
import {WorkAvatar} from './work-composer';
import {currentTeam} from './team-context';
import {preferredTaskMode,prepareAgentTaskDraft,rememberTaskMode,taskCreationActors} from './task-creation-mode';

export function CreationTabs({mode,onChange,scope}:any){
 const refs=useRef<(HTMLButtonElement|null)[]>([]);
 return <div className="creation-tabs" role="tablist" aria-label="新建类型">{[['chat','会话',MessageSquare],['task','任务',ListTodo]].map(([id,label,Icon]:any,i)=><button key={id} ref={el=>{refs.current[i]=el}} type="button" role="tab" id={'create-tab-'+scope+'-'+id} aria-selected={mode===id} aria-controls={'create-panel-'+id} tabIndex={mode===id?0:-1} onClick={()=>onChange(id)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?1:1-i;onChange(next?'task':'chat');requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('#create-tab-'+(next?'task-task':'chat-chat'))?.focus())}}}><Icon size={15}/>{label}</button>)}</div>
}

const emptyDraft={title:'',description:'',status:'待办',assignee:'无负责人',priority:'无优先级',labels:[] as string[],project:''};
export function TaskComposer({workspace,who,header,active}:any){
 const draftKey='mw-create-task:'+currentTeam().id+':'+who;
 const [draft,setDraft]=useState(()=>{try{return {...emptyDraft,...JSON.parse(sessionStorage.getItem(draftKey)||'{}')}}catch{return {...emptyDraft}}});
 const executors=taskCreationActors(workspace,who);
 const [mode,setMode]=useState(preferredTaskMode),[actor,setActor]=useState(executors[0].value);
 const isAgent=mode==='agent',executor=executors.find(a=>a.value===actor);
 const description=useRef<HTMLTextAreaElement>(null);
 const switchMode=()=>{const next=isAgent?'manual':'agent';setMode(next);rememberTaskMode(next);setError('')};
 const [files,setFiles]=useState<any[]>([]),[error,setError]=useState(''),[reading,setReading]=useState(false);
 const title=useRef<HTMLInputElement>(null),upload=useRef<HTMLInputElement>(null),saving=useRef(false);
 useEffect(()=>{sessionStorage.setItem(draftKey,JSON.stringify(draft))},[draft,draftKey]);
 useEffect(()=>{if(active)(isAgent?description.current:title.current)?.focus()},[active,isAgent]);
 const patch=(values:any)=>{setDraft((old:any)=>({...old,...values}));setError('')};
 const actors=[{value:'无负责人',label:'暂不分配',empty:true},...Array.from(new Set([who,...workspace.members.map((m:any)=>m.name)])).map(name=>({value:name,label:name,group:'成员'})),...workspace.agents.map((a:any)=>({value:a.name,label:a.name,group:'智能体'})),...workspace.squads.map((s:any)=>({value:s.name,label:s.name,group:'小队'}))];
 const labelOptions=Array.from(new Set(['需求','设计','研发','缺陷','文档',...workspace.issues.flatMap((i:BoardIssue)=>i.labels||[]),...draft.labels]));
 const addFiles=async(list:File[])=>{
  setReading(true);setError('');
  try{const added=[];for(const f of list){if(f.size>3*1024*1024){setError('单个附件不能超过 3 MB');continue}const url=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('文件读取失败，请重试'));reader.readAsDataURL(f)});added.push({name:f.name,size:f.size,type:f.type,url})}setFiles(old=>[...old,...added])}catch{setError('文件读取失败，请重试')}finally{setReading(false)}
 };
 const submit=()=>{
  if(saving.current||reading)return;
  if(isAgent&&(!draft.description.trim()||!executor)){setError('请选择智能体或小队，并说明需要完成的工作');description.current?.focus();return}
  if(!isAgent&&!draft.title.trim()){setError('先用一句话概括任务');title.current?.focus();return}
  saving.current=true;
  try{
   const now=new Date().toISOString();
   const agentDraft=isAgent&&executor?prepareAgentTaskDraft({actor:executor,prompt:draft.description,project:draft.project,createdBy:who,attachments:files}):undefined;
   const values=agentDraft?.values??{...draft,title:draft.title.trim(),createdBy:who,createdAt:now,updatedAt:now};
   const issue=createIssue(values,files.length?{id:crypto.randomUUID(),author:who,text:'添加了任务附件',createdAt:now,attachments:files,reactions:[]}:undefined,agentDraft?.request);
   sessionStorage.removeItem(draftKey);location.href=issueUrl(issue.id);
  }catch{setError('保存失败，请检查浏览器存储空间');saving.current=false}
 };
 return <div className="composer-root mw-collab-composer composer-home task-composer" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void addFiles(Array.from(e.dataTransfer.files))}}><div className="composer"><div className="composer-inner">
  <div className="creation-header">{header}<div className="task-creation-actions"><span className="task-creator"><span>创建者</span><WorkAvatar name={who}/><strong>{who}</strong></span><button type="button" className="task-mode-switch" title={isAgent?'切换到手动':'切换到智能体'} aria-label={isAgent?'切换到手动':'切换到智能体'} onClick={switchMode}><ArrowLeftRight size={15}/><span>{isAgent?'智能体':'手动'}</span></button></div></div>
   <form onSubmit={e=>{e.preventDefault();submit()}} onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'&&!e.nativeEvent.isComposing&&!document.querySelector('[data-mc-popup]')){e.preventDefault();submit()}}}>
   <div className="task-compose-content">{isAgent?<><label className="task-compose-title" htmlFor="agent-task-requirements">描述任务需求</label><p id="agent-task-hint" className="task-compose-agent-hint">只需描述需求，标题、负责人、优先级和标签可在草稿里调整。</p></>:<input ref={title} className="task-compose-title" aria-label="任务标题" placeholder="用一句话概括任务" value={draft.title} onChange={e=>patch({title:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'&&!e.metaKey&&!e.ctrlKey)e.preventDefault()}}/>}
   <textarea ref={description} id={isAgent?'agent-task-requirements':undefined} aria-describedby={isAgent?'agent-task-hint':undefined} aria-label={isAgent?'任务需求':'任务补充说明'} placeholder={isAgent?'告诉智能体要做什么、期望怎样的结果…':'补充背景、具体要求或期望结果…'} value={draft.description} onChange={e=>patch({description:e.target.value})}/>
   {!!files.length&&<div className="task-compose-files">{files.map((f:any,i:number)=><span key={i}><Paperclip size={13}/><span>{f.name}</span><button type="button" aria-label={'移除任务附件 '+f.name} onClick={()=>setFiles(old=>old.filter((_,n)=>n!==i))}><X size={13}/></button></span>)}</div>}
   <button type="button" className="task-add-file" onClick={()=>upload.current?.click()} disabled={reading}><Paperclip size={15}/>{reading?'正在添加…':'添加文件'}<span>参考资料、图片或文档</span></button></div>
   <div className="task-compose-properties" aria-label={isAgent?'起草设置':'任务属性'}>
    {isAgent?<Select label="选择智能体或小队" value={actor} options={executors} onChange={(value:string)=>{setActor(value);setError('')}}><Bot size={14}/><span>{executor?.label||'选择智能体或小队'}</span><ChevronDown size={12}/></Select>:<>
    <Select label="任务状态" value={draft.status} options={boardStatuses} searchable={false} onChange={(status:string)=>patch({status})}><IssueStatusIcon status={draft.status}/><span>{draft.status}</span><ChevronDown size={12}/></Select>
    <Select label="任务负责人" value={draft.assignee} options={actors} onChange={(assignee:string)=>patch({assignee})}><UserRound size={14}/><span>{draft.assignee==='无负责人'?'暂不分配':draft.assignee}</span><ChevronDown size={12}/></Select>
    <Select label="任务优先级" value={draft.priority} options={priorities} searchable={false} onChange={(priority:string)=>patch({priority})}><Flag size={14}/><span>{draft.priority}</span><ChevronDown size={12}/></Select>
    <Select label="任务标签" multiple value={draft.labels} options={labelOptions} onChange={(labels:string[])=>patch({labels})}><Tag size={14}/><span>{draft.labels.length?draft.labels.join('、'):'无标签'}</span><ChevronDown size={12}/></Select>
    </>}
    <Select label="任务项目" value={draft.project} options={[{value:'',label:isAgent?'关联项目（可选）':'无项目',empty:true},...workspace.projects.map((p:any)=>({value:p.name,label:p.name}))]} onChange={(project:string)=>patch({project})}><Folder size={14}/><span>{draft.project||(isAgent?'关联项目（可选）':'无项目')}</span><ChevronDown size={12}/></Select>
   </div>
   {error&&<p className="task-compose-error" role="alert">{error}</p>}
   <footer className="task-compose-footer"><span><Check size={13}/>{isAgent?'保存为待规划任务 · 不调用真实智能体':'创建后可在任务看板中跟进'}</span><div><kbd>⌘ / Ctrl ↵</kbd><button type="submit" className="task-create-submit" disabled={(isAgent?!draft.description.trim()||!executor:!draft.title.trim())||reading}>{isAgent?'创建任务草稿':'创建任务'}<ArrowUpRight size={16}/></button></div></footer>
  </form>
 </div></div><input ref={upload} type="file" multiple hidden aria-label="添加任务文件" onChange={e=>{void addFiles(Array.from(e.target.files||[]));e.target.value=''}}/></div>
}
