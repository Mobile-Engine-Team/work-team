import React,{useState} from 'react';
import {ArrowLeft,CalendarDays,ChevronRight,Folder,GitBranch,Plus,Search,Settings2,Target,Trash2} from 'lucide-react';
import {Button,Confirm,Modal,Select} from './primitives';
import {RichText} from './rich-editor';
import {type Issue,type Project,priorities,updateWorkspace,useWorkspace} from './store';
import {plainText} from './board-model';
import {useIdentity} from '../local-identity';
import {teamUrl} from '../team-context';
import { ProjectStart, ProjectTaskRows, projectDependencies, projectVersion, taskInProgress } from './project-tasks';
import { Action } from './project-reference-ui';

export const projectSections=[['overview','总览'],['blueprint','施工蓝图'],['tasks','任务']] as const;
export type ProjectSection=typeof projectSections[number][0];
export const readProjectSection=(value:string|null):ProjectSection=>projectSections.find(([key])=>key===value)?.[0]||'overview';
export const projectsHref=()=>teamUrl('work.html?view='+encodeURIComponent('全部项目'));
export const projectHref=(name:string,section:ProjectSection='overview')=>teamUrl('work.html?project='+encodeURIComponent(name)+(section==='overview'?'':'&section='+section));
const projectStatuses=['计划中','进行中','已暂停','已完成','已取消'];
const statusTone=(status:string)=>({'进行中':'active','已暂停':'paused','已完成':'done','已取消':'off'}[status]||'plan');
function Status({value}: {value:string}){return <span className="pd-status" data-tone={statusTone(value)}><i/>{value}</span>}
const activeProjectTasks=(issues:Issue[],project:string)=>issues.filter(i=>!i.archived&&i.project===project);
const taskStats=(issues:Issue[])=>({done:issues.filter(i=>i.status==='已完成').length,progress:issues.filter(i=>['进行中','审核中'].includes(i.status)).length,cancelled:issues.filter(i=>i.status==='已取消').length});

export function ProjectCatalog({onCreate,onOpen}: {onCreate:()=>void;onOpen:(name:string)=>void}){
 const {projects,issues}=useWorkspace();
 const [query,setQuery]=useState(''),[status,setStatus]=useState('');
 const search=query.trim().toLowerCase();
 const rows=projects.filter(p=>(!status||p.status===status)&&(!search||(p.name+' '+plainText(p.description)).toLowerCase().includes(search)));
 return <main className="pd-scroll"><div className="pd-shell">
  <header className="pd-page-heading"><div><h1>全部项目</h1><p>在当前空间统一查看项目目标、蓝图与任务进度。</p></div><Button primary onClick={onCreate}><Plus size={17}/>新建项目</Button></header>
  {projects.length>0?<>
   <div className="pd-catalog-tools"><label className="pd-search"><Search size={15}/><input aria-label="搜索项目" placeholder="搜索项目…" value={query} onChange={e=>setQuery(e.target.value)}/></label><Select label="筛选项目状态" value={status} options={[["",'全部状态'],...projectStatuses]} onChange={setStatus} searchable={false}/><span>共 {rows.length} 个项目</span></div>
   {rows.length?<div className="pd-project-grid">{rows.map((p,index)=>{const tasks=activeProjectTasks(issues,p.name),{done,cancelled}=taskStats(tasks),total=tasks.length-cancelled;return <a className="pd-project-card" href={projectHref(p.name)} key={p.name} onClick={e=>{if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onOpen(p.name)}}}><header><span className="pd-project-icon" data-color={index%3}><Folder size={19}/></span><Status value={p.status}/></header><h2>{p.name}<ChevronRight size={16}/></h2><p>{plainText(p.description)||'暂无目标与交付标准'}</p><div className="pd-progress" role="progressbar" aria-label="任务完成进度" aria-valuenow={total?Math.round(100*done/total):0}><i style={{width:(total?100*done/total:0)+'%'}}/></div><div className="pd-card-meta"><span>{done}/{total} 项任务已完成</span><span>{projectVersion(p)?'蓝图 V'+projectVersion(p)!.number:'尚无正式计划'}</span></div><footer><span>{p.lead||'无负责人'}</span><span><CalendarDays size={13}/>{p.due||'日期待定'}</span></footer></a>})}</div>:<div className="pd-empty"><Search size={26}/><h2>没有匹配的项目</h2><p>试试其他关键词或清除筛选条件。</p><Button onClick={()=>{setQuery('');setStatus('')}}>清除筛选</Button></div>}
  </>:<div className="pd-empty"><Folder size={28}/><h2>还没有项目</h2><p>先写下目标和交付标准，再用蓝图安排后续任务。</p><Button primary onClick={onCreate}><Plus size={16}/>新建项目</Button></div>}
 </div></main>
}

export function ProjectHeader({project,section,taskCount,onSelect,onBack,onSettings}: {project:Project;section:ProjectSection;taskCount:number;onSelect:(s:ProjectSection)=>void;onBack:()=>void;onSettings:()=>void}){
 const version=projectVersion(project);
 return <header className="pd-project-header"><a className="pd-back" href={projectsHref()} onClick={e=>{if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onBack()}}}><ArrowLeft size={15}/>全部项目</a>
  <div className="pd-page-heading"><div><Status value={project.status}/><h1>{project.name}</h1><div className="pd-heading-meta"><span>{project.lead||'无负责人'}</span><span><CalendarDays size={14}/>{project.start?(project.start+(project.due?' 至 '+project.due+' 截止':' 开始')):project.due?project.due+' 截止':'日期待定'}</span><span>{version?'V'+version.number:'尚无正式计划'}</span></div></div><Action onClick={onSettings}><Settings2 size={16}/>项目设置</Action></div>
  <nav className="pd-project-tabs" aria-label="项目页面">{projectSections.map(([id,label])=><a key={id} aria-current={id===section?'page':undefined} href={projectHref(project.name,id)} onClick={e=>{if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onSelect(id)}}}>{label}{id==='tasks'&&<small>{taskCount}</small>}</a>)}</nav>
 </header>
}

export function ProjectOverview({project,tasks,onSelect,onOrganize,onTask}: {project:Project;tasks:Issue[];onSelect:(section:ProjectSection)=>void;onOrganize:()=>void;onTask:(id:number)=>void}){
 const {issues}=useWorkspace();
 const {done,progress,cancelled}=taskStats(tasks),version=projectVersion(project);
 const [starting,setStarting]=useState(false);
 const {planned,unmet}=projectDependencies(project,issues);
 const waiting=(i:Issue)=>unmet(i).length>0;
 const active=tasks.filter(i=>i.status!=='已完成'&&i.status!=='已取消');
 const plannedActive=active.filter(planned);
 const queues=[
  ['正在推进',plannedActive.filter(i=>taskInProgress(i)&&!waiting(i))],
  ['待开始',plannedActive.filter(i=>!waiting(i)&&['待规划','待办'].includes(i.status))],
  ['等待前置',plannedActive.filter(waiting)],
  ['最近交付',tasks.filter(i=>i.status==='已完成').sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||'')).slice(0,4)],
  ['未编入当前计划',tasks.filter(i=>!planned(i))],
 ] as const;
 return <div className="project-overview">
  <div className="project-overview-top"><article className="project-goal"><Target size={22}/><div><h3>目标与交付标准</h3>{project.description?<RichText content={project.description}/>:<p>还未添加目标与交付标准。可以在项目设置中补充。</p>}</div></article><div className="project-counts">{[['已知任务',tasks.length],['已完成',done],['正在推进',progress],['已取消',cancelled]].map(([label,value])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div></div>
  {!version?<div className="project-get-started"><div><GitBranch size={26}/><h3>{project.blueprint?.draft?'继续完善计划草案':'从一张小蓝图开始'}</h3><p>拆出关键任务和前置关系，确认后再发布为正式计划。</p></div><Action primary onClick={onOrganize}>{project.blueprint?.draft?'继续编辑蓝图':'绘制蓝图'}</Action></div>:<div className="project-section-heading"><h2>当前计划 V{version.number}</h2><div className="project-actions"><Action onClick={()=>onSelect('blueprint')}>查看施工蓝图</Action><Action primary onClick={()=>setStarting(true)}>查看可推进任务</Action></div></div>}
  <div className="project-overview-grid">{queues.map(([label,items])=><article key={label}><div className="project-section-heading"><h3>{label}</h3><span>{items.length}</span></div><ProjectTaskRows issues={items} waiting={waiting} onOpen={onTask}/></article>)}</div>
  {starting&&<ProjectStart project={project} onClose={()=>setStarting(false)} onViewChanges={()=>{setStarting(false);onOrganize();}}/>}
 </div>
}

export function ProjectDialog({project,onClose,onSaved,onDelete}: {project?:Project;onClose:()=>void;onSaved:(name:string)=>void;onDelete?:()=>void}){
 const data=useWorkspace(),who=useIdentity();
 const [name,setName]=useState(project?.name||''),[description,setDescription]=useState(project?.description||''),[status,setStatus]=useState(project?.status||'计划中'),[lead,setLead]=useState(project?.lead||who),[due,setDue]=useState(project?.due||''),[start,setStart]=useState(project?.start||''),[priority,setPriority]=useState(project?.priority||'无优先级'),[error,setError]=useState(''),[remove,setRemove]=useState(false);
 const submit=()=>{
  const title=name.trim();
  if(!title){setError('请输入项目名称');return}
  if(data.projects.some(p=>p.name===title&&p.name!==project?.name)){setError('已存在同名项目');return}
  if(start&&due&&due<start){setError('截止日期不能早于开始日期');return}
  updateWorkspace(s=>{const values={name:title,description:description.trim(),status,lead,due,start,priority};if(!project){s.projects.push({...values,workflow:'Default',resources:[]});return}
   const p=s.projects.find(p=>p.name===project.name);if(!p)return;Object.assign(p,values);
   if(title!==project.name){s.issues.forEach(i=>{if(i.project===project.name)i.project=title});s.issueCreationRequests.forEach(i=>{if(i.project===project.name)i.project=title})}
  });
  onSaved(title);onClose();
 };
 return <><Modal title={project?'项目设置':'新建项目'} onClose={onClose} className="pd-dialog" footer={<>{onDelete&&<button className="pd-danger" onClick={()=>setRemove(true)}><Trash2 size={15}/>删除项目</button>}<Button onClick={onClose}>取消</Button><Button primary onClick={submit}>{project?'保存设置':'创建项目'}</Button></>}>
  <form className="pd-form" onSubmit={e=>{e.preventDefault();submit()}}><label>项目名称<input autoFocus aria-label="项目名称" value={name} onChange={e=>{setName(e.target.value);setError('')}} maxLength={100} placeholder="例如：品牌内容计划"/></label><label>目标与交付标准 <small>可选</small><textarea aria-label="目标与交付标准" value={description} onChange={e=>setDescription(e.target.value)} rows={4} placeholder="计划完成什么？怎样算交付完成？"/></label>
  {project?<div className="pd-form-grid"><label>项目状态<Select label="项目状态" value={status} onChange={setStatus} options={projectStatuses} searchable={false}/></label><label>项目负责人<Select label="项目负责人" value={lead} onChange={setLead} options={[...new Set(['无负责人',lead,who,...data.members.map(m=>m.name)])]}/></label><label>优先级<Select label="项目优先级" value={priority} onChange={setPriority} options={priorities} searchable={false}/></label><label>开始日期<input type="date" aria-label="开始日期" value={start} onChange={e=>setStart(e.target.value)}/></label><label>截止日期<input type="date" aria-label="截止日期" value={due} onChange={e=>setDue(e.target.value)}/></label></div>:<p>创建后进入项目总览。负责人、日期等信息可在项目设置中补充。</p>}
  {error&&<p role="alert" className="pd-error">{error}</p>}</form>
 </Modal>{remove&&<Confirm title="删除项目" description={`删除「${project?.name}」及其蓝图？项目任务仍会保留，并移至无关联项目。`} onClose={()=>setRemove(false)} onConfirm={onDelete}/>}</>
}
