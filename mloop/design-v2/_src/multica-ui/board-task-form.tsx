import React,{useRef,useState} from 'react';
import {Modal,Button,Select,DatePicker,Avatar,IconButton} from './primitives';
import {RichEditor,RichText} from './rich-editor';
import {useWorkspace,createIssue,updateWorkspace,priorities,IssueCreationRequest} from './store';
import {boardStatuses,BoardIssue,plainText} from './board-model';
import {Plus,Bot,Paperclip,Check,X,ArrowLeftRight} from '../multica-icons';

const modeKey='mw-task-create-mode-v1';
function preferredMode(){try{return localStorage.getItem(modeKey)==='agent'?'agent':'manual'}catch{return 'manual'}}
export function BoardTaskForm({initial={},onClose,onCreated}:any){
  const data=useWorkspace();
  const actors=[...data.agents.map(a=>({value:'agent:'+a.name,label:a.name,description:a.runtime,group:'智能体',icon:Bot})),...data.squads.map(s=>({value:'squad:'+s.name,label:s.name,description:'队长 '+s.leader,group:'小队',icon:Bot}))];
  const initialActor=actors.find(a=>a.label===initial.assignee)?.value||actors[0]?.value||'';
  const [mode,setMode]=useState(initial.id?'manual':preferredMode()),[actor,setActor]=useState(initialActor),[title,setTitle]=useState(initial.title||''),[description,setDescription]=useState(initial.description||''),[status,setStatus]=useState(initial.status||'待办'),[priority,setPriority]=useState(initial.priority||'无优先级'),[assignee,setAssignee]=useState(initial.assignee||'无负责人'),[project,setProject]=useState(initial.project||'无关联项目'),[start,setStart]=useState(initial.start||''),[due,setDue]=useState(initial.due||''),[parent,setParent]=useState(initial.parent?String(initial.parent):''),[labels,setLabels]=useState((initial.labels||[]).join('，')),[error,setError]=useState(''),[more,setMore]=useState(!!initial.parent),[continueCreating,setContinueCreating]=useState(false),[editorKey,setEditorKey]=useState(0),[attachments,setAttachments]=useState<{name:string;size:number;type:string}[]>([]),[receipt,setReceipt]=useState<IssueCreationRequest|null>(null),[sentCount,setSentCount]=useState(0);
  const files=useRef<HTMLInputElement>(null),editor=useRef<any>(null),saving=useRef(false);
  const isAgent=mode==='agent'&&!initial.id,selectedActor=actors.find(a=>a.value===actor);
  const switchMode=()=>{const next=isAgent?'manual':'agent';setMode(next);localStorage.setItem(modeKey,next);setError('');setEditorKey(k=>k+1);if(next==='manual'&&selectedActor)setAssignee(selectedActor.label);if(next==='agent'){const pick=actors.find(a=>a.label===assignee);if(pick)setActor(pick.value)}};
  const resetDraft=()=>{setTitle('');setDescription('');setAttachments([]);setError('');setReceipt(null);setEditorKey(k=>k+1);requestAnimationFrame(()=>isAgent?editor.current?.focus():document.querySelector<HTMLInputElement>('[aria-label="任务标题"]')?.focus())};
  const save=()=>{
    if(saving.current||receipt)return;
    if(isAgent){
      if(!selectedActor){setError('请选择一个智能体或小队');return}
      if(!plainText(description)){setError('请描述你希望智能体完成的工作');return}
      saving.current=true;
      const request:IssueCreationRequest={id:crypto.randomUUID(),createdAt:new Date().toISOString(),actorType:actor.startsWith('squad:')?'squad':'agent',actorName:selectedActor.label,prompt:description,project:project==='无关联项目'?'':project,priority,due,parent:parent?Number(parent):undefined,status:'已保存 · 本地演示',attachments};
      try{updateWorkspace(s=>{s.issueCreationRequests.push(request)});setSentCount(n=>n+1);if(continueCreating)resetDraft();else setReceipt(request)}catch{setError('保存失败，请重试')}finally{saving.current=false}
      return;
    }
    if(!title.trim()){setError('请输入任务标题');return}
    if(start&&due&&start>due){setError('截止日期不能早于开始日期');return}
    const values:any={title:title.trim(),description,status,priority,assignee,project:project==='无关联项目'?'':project,start,due,parent:parent?Number(parent):undefined,labels:labels.split(/[,，]/).map(x=>x.trim()).filter(Boolean),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    if(initial.id){updateWorkspace(s=>{const issue=s.issues.find(i=>i.id===initial.id);if(issue)Object.assign(issue,values,{createdAt:(issue as BoardIssue).createdAt})});onCreated?.({...initial,...values})}else onCreated?.(createIssue(values));
    if(continueCreating&&!initial.id)resetDraft();else onClose();
  };
  const footer=receipt?<><span className="wb-form-keyhint">本地演示</span><Button onClick={resetDraft}>继续创建</Button><Button primary onClick={onClose}>完成</Button></>:<>
    {isAgent?<><input hidden style={{display:'none'}} ref={files} type="file" multiple aria-label="添加任务附件" onChange={e=>{const next=Array.from(e.target.files||[]).map(f=>({name:f.name,size:f.size,type:f.type}));setAttachments(list=>[...list,...next]);e.target.value=''}}/><IconButton icon={Paperclip} label="添加附件" onClick={()=>files.current?.click()}/></>:<span className="wb-form-keyhint">⌘ Enter</span>}
    {isAgent&&<span className="wb-form-keyhint" role="status">{sentCount?'已保存 '+sentCount+' 个请求':''}</span>}
    {!initial.id&&<><button className="wb-mode-switch" type="button" onClick={switchMode}><ArrowLeftRight size={14}/>{isAgent?'切换到手动':'切换到智能体'}</button><label className="wb-continue"><input type="checkbox" checked={continueCreating} onChange={e=>setContinueCreating(e.target.checked)}/>继续创建</label></>}
    <Button primary onClick={save} disabled={isAgent&&(!selectedActor||!plainText(description))}>{initial.id?'保存更改':isAgent?'创建':'创建任务'}</Button>
  </>;
  return <Modal title={initial.id?'编辑任务':isAgent?'通过智能体创建':'手动创建'} className={'wb-task-form '+(isAgent?'wb-agent-task-form':'')} onClose={onClose} footer={footer}>
    {receipt?<div className="wb-create-receipt" role="status"><span className="wb-receipt-mark"><Check size={24}/></span><h3>创建请求已保存</h3><p>{receipt.actorType==='squad'?'小队':'智能体'} {receipt.actorName} · {receipt.project||'无关联项目'}</p><div className="wb-request-preview"><RichText content={receipt.prompt}/></div>{receipt.attachments.length>0&&<p>{receipt.attachments.length} 个附件 · 仅保存文件信息</p>}<small>当前为本地设计演示，尚未连接智能体服务。</small></div>:<form onSubmit={e=>{e.preventDefault();save()}} onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();e.stopPropagation();save()}}}>
      {isAgent?<div className="wb-creator"><span>创建者</span><Select label="选择智能体或小队" value={actor} options={actors} onChange={(value:string)=>{setActor(value);setError('')}} placeholder="选择智能体或小队…">{selectedActor&&<><Avatar small name={selectedActor.label}/><strong>{selectedActor.label}</strong></>}</Select></div>:<input className="mc-create-title" autoFocus aria-label="任务标题" placeholder="任务标题" value={title} onChange={e=>{setTitle(e.target.value);setError('')}}/>}
      {isAgent&&!actors.length&&<p className="wb-agent-empty">暂无可用智能体或小队。可先到<a href="agents.html">智能体</a>中添加，或切换到手动创建。</p>}
      <div className="wb-task-description"><RichEditor ref={editor} key={mode+':'+editorKey} autoFocus={isAgent} label={isAgent?'任务需求':'任务描述'} initial={description} placeholder={isAgent?'告诉智能体要做什么，例如：排查客户端重复待办的问题，拆分任务并补充验收标准。':'添加描述…'} onChange={(value:string)=>{setDescription(value);setError('')}}/></div>
      {isAgent&&attachments.length>0&&<div className="wb-create-attachments">{attachments.map((file,index)=><span key={index}><Paperclip size={13}/><span>{file.name}</span><small>{Math.max(1,Math.ceil(file.size/1024))} KB</small><IconButton icon={X} label={'移除附件 '+file.name} onClick={()=>setAttachments(list=>list.filter((_,n)=>n!==index))}/></span>)}</div>}
      {!isAgent&&attachments.length>0&&<p className="wb-create-local-note">{attachments.length} 个附件保留在智能体创建草稿中，切换回去可查看。</p>}
      <div className="wb-form-chips">{!isAgent&&<><Select label="任务状态" value={status} options={boardStatuses} onChange={setStatus} searchable={false}/><Select label="任务优先级" value={priority} options={priorities} onChange={setPriority} searchable={false}/><Select label="任务负责人" value={assignee} options={['无负责人',...data.agents.map(a=>a.name),...data.squads.map(a=>a.name),...data.members.map(m=>m.name)]} onChange={setAssignee}/></>}<Select label="任务项目" value={project} options={['无关联项目',...data.projects.map(p=>p.name)]} onChange={setProject}/><button className="wb-more-fields" type="button" aria-label="更多任务属性" aria-expanded={more} onClick={()=>setMore(!more)}><Plus size={13}/>更多</button></div>
      {more&&<div className="wb-form-grid">{isAgent?<label>优先级<Select label="任务优先级" value={priority} options={priorities} onChange={setPriority} searchable={false}/></label>:<label>开始日期<DatePicker label="开始日期" value={start} onChange={setStart}/></label>}<label>截止日期<DatePicker label="截止日期" value={due} onChange={setDue}/></label><label>父任务<Select label="父任务" value={parent} options={[{value:'',label:'无父任务'},...data.issues.filter(i=>i.id!==initial.id&&!i.parent).map(i=>({value:String(i.id),label:'ANDR-'+i.id+' '+i.title}))]} onChange={setParent}/></label>{!isAgent&&<label>标签<input aria-label="任务标签" placeholder="用逗号分隔" value={labels} onChange={e=>setLabels(e.target.value)}/></label>}</div>}
      {isAgent&&parent&&<p className="wb-create-local-note">作为 ANDR-{parent} 的子任务</p>}{isAgent&&<p className="wb-create-local-note">本地演示 · 创建请求和附件信息仅保存在当前浏览器</p>}{error&&<p role="alert" className="mc-form-error">{error}</p>}
    </form>}
  </Modal>
}
