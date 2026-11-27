import {BUILTIN_WORK} from '../builtin-work';
import type {WorkExecution} from '../collaboration-store';
import {identity} from '../local-identity';
import {readJournal,writeJournal,watchJournal} from '../local-journal';
import {teamKey,currentTeam,teams,teamUrl} from '../team-context';
import {workspaceTeamSeed} from '../team-seeds';
import {useSyncExternalStore} from 'react';

export type Issue = {id:number;parentIssueId?:number;title:string;description:string;project:string;status:string;priority:string;assignee:string;actor?:string;avatar?:string;createdAt?:string;createdBy?:string;updatedAt?:string;subscribed:boolean;pinned:boolean;ago?:string;archived?:boolean;read?:boolean;sourceConversationId?:string;start?:string;due?:string;reactions?:string[]};
export type Comment = {execution?:WorkExecution;createdAt?:string;replyTo?:string;id:string;issue:number;text:string;html?:string;reply?:boolean;attachments?:{name:string;url?:string;type?:string}[];author:string;reactions?:string[]};
export type IssueCreationRequest = {id:string;createdAt:string;actorType:'agent'|'squad';actorName:string;prompt:string;project:string;status:string;attachments:{name:string;size:number;type:string}[]};
export type BlueprintNode={id:string;title:string;description:string;issueId?:number;after:string[];x?:number;y?:number;assignee?:string;due?:string;requirements?:Record<string,string>;edgeIds?:Record<string,string>;assigneeType?:string;baseline?:{title:string;description:string;requirements:string;assignee_id:string;assignee_type:string;due_date:string}};
export type Project={name:string;description:string;status:string;priority:string;lead:string;start:string;due:string;workflow:string;resources:{name:string;url?:string}[];blueprint?:{draft?:BlueprintNode[];draftAuthor?:string;versions:{number:number;nodes:BlueprintNode[];note?:string;author?:string;createdAt?:string;starts?:{issueId:number;assignee:string;kind:"member"|"agent";at:string}[]}[]}};
const inboxBase = {project:'客户端',priority:'无优先级',subscribed:true,pinned:false};
export const inboxFeed: Issue[] = [
  {id:3,...inboxBase,actor:'陈晓',avatar:'expert-img/img-2.png',assignee:'陈晓',title:'弱网重试出现两条待办',description:'同一请求超时重放后生成了两条待办',ago:'56 分钟',status:'阻塞',read:true},
  {id:2,...inboxBase,actor:'林可',avatar:'expert-img/img-5.png',assignee:'林可',title:'菜单需求还缺少验收标准',description:'还无法确定要改哪一个菜单',ago:'1 小时',status:'阻塞',read:true},
  {id:4,...inboxBase,actor:'Mika',avatar:'expert-img/img-12.png',assignee:'Mika',title:'修复助手提交了首版补丁',description:'服务端已按请求标识查重',ago:'2 小时',status:'进行中',read:false},
  {id:5,...inboxBase,actor:'周衡',avatar:'expert-img/img-8.png',assignee:'周衡',title:'独立回归发现重复待办',description:'期望 1 条，实得 2 条',ago:'3 小时',status:'待办',read:false},
  {id:6,...inboxBase,actor:'Mika',avatar:'expert-img/img-12.png',assignee:'Mika',title:'修订补丁等待复验',description:'已复用首次提交的请求标识',ago:'昨天',status:'进行中',read:true},
  {id:7,...inboxBase,actor:'陈晓',avatar:'expert-img/img-2.png',assignee:'陈晓',title:'陈晓完成了第二轮回归',description:'同请求重放 3 次只生成 1 条',ago:'昨天',status:'已完成',read:true},
  {id:8,...inboxBase,actor:'苏晚',avatar:'expert-img/img-15.png',assignee:'苏晚',title:'项目待负责人验收',description:'两轮补丁和回归报告都已留档',ago:'2天前',status:'待办',read:false},
  {id:9,...inboxBase,actor:'Mika',avatar:'expert-img/img-12.png',assignee:'Mika',title:'每日构建有一次失败',description:'共享构建机上的回归没有通过',ago:'2天前',status:'阻塞',read:true},
  {id:10,...inboxBase,actor:'林可',avatar:'expert-img/img-5.png',assignee:'林可',title:'发布说明需要你确认',description:'结项前请核对验收备注',ago:'3天前',status:'待办',read:false},
];
export const seed = {
  issues: inboxFeed,
  comments: [] as Comment[],
  chatMessages: [] as {id:string;text:string}[],
  drafts: {} as Record<string,string>,
  projects: [{name:'客户端',description:'移动端待办与发布',status:'进行中',priority:'无优先级',lead:'陈晓',start:'',due:'',workflow:'Default',resources:[]} ] as Project[],
  agents: [{name:'Mika',description:'你的工作区 Chief of Staff。Mika 会把目标转化为可执行任务，协调团队并持续跟进。',runtime:'Codex (xymtopdeMacBook)',visibility:'工作区',instructions:'',model:'默认',online:true,runs:5,emoji:'🦄',skills:[] as string[]}],
  members: [{name:'xym',email:'xym@example.com',role:'管理员'},{name:'Patrick',email:'patrick@example.com',role:'成员'}],
  squads: [{name:'仙女座星系',description:'',leader:'Mika',members:['Mika']}],
  skills: [{name:'浏览器',description:'浏览网页并与页面交互',enabled:true},{name:'代码审查',description:'检查代码变更',enabled:true}],
  views: ['未命名视图'],
  viewLayouts: {} as Record<string,string>,
  invitations: [] as {email:string;role:string;id:string}[],
  issueCreationRequests: [] as IssueCreationRequest[],
};
export type Workspace = typeof seed;
export function isRelatedIssue(issue:Issue,workspace:Workspace){return issue.assignee===identity()||(identity()==='肖叶茂'&&issue.assignee==='xym')||issue.subscribed||(issue as any).subscribers?.includes('xym')||workspace.comments.some(c=>c.issue===issue.id&&(c.author===identity()||(identity()==='肖叶茂'&&c.author==='xym')));}

const key = ()=>teamKey('mw-multica-workspace-v4');
const workspaceBase=(teamId:string):Workspace=>{const creator=teams.find(t=>t.id===teamId)?.creator;return {...workspaceTeamSeed(seed,teamId),issues:[],comments:[],chatMessages:[],projects:[],members:creator?[{name:creator,email:creator.includes('@')?creator:'owner@'+teamId+'.invalid',role:'所有者'}]:[],agents:[],squads:[]}};
export const getWorkspaceSeed=()=>workspaceBase(currentTeam().id);
function base():Workspace {try{return {...getWorkspaceSeed(),...JSON.parse(localStorage.getItem(key())||'{}')}}catch{return getWorkspaceSeed()}}
// Keep existing tasks and their IDs, but flatten the legacy hierarchy on read.
function withoutTaskHierarchy(data:Workspace):Workspace{
 const agents=data.agents.some(a=>(a as any).expertId===BUILTIN_WORK.id)?data.agents:[...data.agents,{...BUILTIN_WORK,expertId:BUILTIN_WORK.id,visibility:BUILTIN_WORK.access,online:true,runs:0,emoji:'',skills:[]}];
 data={...data,agents};
 const flatten=<T,>(item:T)=>{const {parent,...rest}=item as T & {parent?:number};return rest as T};
 return {...data,issues:data.issues.map(flatten),issueCreationRequests:data.issueCreationRequests.map(flatten)};
}
function read():Workspace{return {...withoutTaskHierarchy(readJournal(key(),base)),drafts:JSON.parse(sessionStorage.getItem(key()+':drafts:'+identity())||'{}')}}
let state = read();
const listeners = new Set<()=>void>();
export function updateWorkspace(mutate:(draft:Workspace)=>void) {
  const before=read(),draft = structuredClone(before);
  mutate(draft);
  // Record creation and assignment at the shared mutation boundary, including board/form edits.
  for(const issue of draft.issues){
    const old=before.issues.find(i=>i.id===issue.id),next=issue as any;
    if(!old){next.createdAt ||= new Date().toISOString();next.createdBy=identity();}
    else if(old.assignee!==issue.assignee){
      const prior=new Set(((old as any).activity||[]).map((e:any)=>e.id));
      const event=(next.activity||[]).find((e:any)=>!prior.has(e.id)&&e.text?.startsWith('将负责人改为'));
      if(event)Object.assign(event,{assignee:issue.assignee,author:event.author||identity()});
      else (next.activity ||= []).push({id:crypto.randomUUID(),text:'将负责人改为 '+issue.assignee,time:new Date().toISOString(),author:identity(),assignee:issue.assignee});
      next.updatedAt=new Date().toISOString();
    }
  }
  writeJournal(key(),before,draft);
  state = read();
  listeners.forEach(fn=>fn());
}
export const getWorkspace=()=>read();
export function useWorkspace() {return useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>state)}
export const patchIssue = (id:number,patch:Partial<Issue>) => updateWorkspace(s=>{const issue=s.issues.find(x=>x.id===id);if(issue)Object.assign(issue,patch)});
export function allocateIssueId(issues:Issue[]){let id:number;do{id=1000000+crypto.getRandomValues(new Uint32Array(1))[0]%9000000}while(issues.some(i=>i.id===id));return id}
export function createIssue(values:Partial<Issue>,initialComment?:Omit<Comment,'issue'>,request?:IssueCreationRequest) {
  const issue:Issue={id:allocateIssueId(read().issues),title:'',description:'',project:state.projects[0]?.name||'',status:'待规划',priority:'无优先级',assignee:'无负责人',subscribed:true,pinned:false,read:false,...values};
  if(!issue.id)issue.id=allocateIssueId(read().issues);
  updateWorkspace(s=>{s.issues.push(issue);if(request)s.issueCreationRequests.push(request);if(initialComment)s.comments.push({...initialComment,issue:issue.id})});
  return issue;
}
export function readTeamWorkspace(teamId:string):Workspace {
  const base=workspaceBase(teamId);
  return withoutTaskHierarchy(readJournal(teamKey('mw-multica-workspace-v4',teamId),()=>{try{return {...base,...JSON.parse(localStorage.getItem(teamKey('mw-multica-workspace-v4',teamId))||'{}')}}catch{return base}}))
}
export function createIssueInTeam(teamId:string,values:Partial<Issue>) {
  if(!teams.some(t=>t.id===teamId))throw new Error('团队不存在');
  if(currentTeam().id===teamId)return createIssue(values);
  const workspace=readTeamWorkspace(teamId),before=structuredClone(workspace);
  const issue:Issue={id:allocateIssueId(workspace.issues),title:'',description:'',project:'',status:'待办',priority:'无优先级',assignee:'无负责人',subscribed:true,pinned:false,read:false,...values};
  issue.createdAt ||= new Date().toISOString();
  issue.createdBy=identity();
  workspace.issues.push(issue);
  writeJournal(teamKey('mw-multica-workspace-v4',teamId),before,workspace);
  return issue;
}
export function setDraft(draftKey:string,text:string){const drafts={...state.drafts};if(text.trim())drafts[draftKey]=text;else delete drafts[draftKey];sessionStorage.setItem(key()+':drafts:'+identity(),JSON.stringify(drafts));state={...state,drafts};listeners.forEach(fn=>fn())}
export function issueUrl(id:number){return teamUrl('work.html?issue='+id)}
export function projectUrl(name:string){return teamUrl('work.html?project='+encodeURIComponent(name))}
export const statuses = ['待规划','待办','进行中','已完成','已取消','阻塞'];
export const priorities = ['无优先级','紧急','高','中','低'];
export function copyText(value:string){return navigator.clipboard.writeText(value)}

watchJournal(key,()=>{state=read();listeners.forEach(fn=>fn())});

window.addEventListener('mw-workspace-change',()=>{state=read();listeners.forEach(fn=>fn())});
window.addEventListener('storage',event=>{if(event.key===teamKey('mw-expert-agents-v1')){state=read();listeners.forEach(fn=>fn())}});

window.addEventListener('mw-team-change',()=>{state=read();listeners.forEach(fn=>fn())});

window.addEventListener('mw-identity',()=>{state=read();listeners.forEach(fn=>fn())});
