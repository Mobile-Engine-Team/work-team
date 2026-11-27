import {teamKey,currentTeam,teams} from '../team-context';
import {workspaceTeamSeed} from '../team-seeds';
import {useSyncExternalStore} from 'react';

export type Issue = {id:number;title:string;description:string;project:string;status:string;priority:string;assignee:string;actor?:string;avatar?:string;subscribed:boolean;pinned:boolean;ago?:string;archived?:boolean;read?:boolean;parent?:number;start?:string;due?:string;reactions?:string[]};
export type Comment = {createdAt?:string;replyTo?:string;id:string;issue:number;text:string;html?:string;reply?:boolean;attachments?:{name:string;url?:string;type?:string}[];author:string;reactions?:string[]};
export type IssueCreationRequest = {id:string;createdAt:string;actorType:'agent'|'squad';actorName:string;prompt:string;project:string;priority:string;due:string;parent?:number;status:string;attachments:{name:string;size:number;type:string}[]};
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
  projects: [{name:'客户端',description:'移动端待办与发布',status:'进行中',priority:'无优先级',lead:'陈晓',start:'',due:'',workflow:'Default',resources:[] as {name:string;url?:string}[]}],
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
const key = ()=>teamKey('mw-multica-workspace-v4');
export const getWorkspaceSeed=():Workspace=>workspaceTeamSeed(seed);
function read():Workspace {try{return {...getWorkspaceSeed(),...JSON.parse(localStorage.getItem(key())||'{}')}}catch{return getWorkspaceSeed()}}
let state = read();
const listeners = new Set<()=>void>();
export function updateWorkspace(mutate:(draft:Workspace)=>void) {
  const draft = structuredClone(state);
  mutate(draft);
  localStorage.setItem(key(),JSON.stringify(draft));
  state = draft;
  listeners.forEach(fn=>fn());
}
export function useWorkspace() {return useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>state)}
export const patchIssue = (id:number,patch:Partial<Issue>) => updateWorkspace(s=>{const issue=s.issues.find(x=>x.id===id);if(issue)Object.assign(issue,patch)});
export function createIssue(values:Partial<Issue>) {
  const issue:Issue={id:Math.max(3,...state.issues.map(x=>x.id))+1,title:'',description:'',project:state.projects[0]?.name||'',status:'待规划',priority:'无优先级',assignee:'无负责人',subscribed:true,pinned:false,read:false,...values};
  updateWorkspace(s=>{s.issues.push(issue)});
  return issue;
}
export function readTeamWorkspace(teamId:string):Workspace {
  const base=workspaceTeamSeed(seed,teamId);
  try{return {...base,...JSON.parse(localStorage.getItem(teamKey('mw-multica-workspace-v4',teamId))||'{}')}}catch{return base}
}
export function createIssueInTeam(teamId:string,values:Partial<Issue>) {
  if(!teams.some(t=>t.id===teamId))throw new Error('团队不存在');
  if(currentTeam().id===teamId)return createIssue(values);
  const workspace=readTeamWorkspace(teamId);
  const issue:Issue={id:Math.max(3,...workspace.issues.map(x=>x.id))+1,title:'',description:'',project:'',status:'待办',priority:'无优先级',assignee:'无负责人',subscribed:true,pinned:false,read:false,...values};
  workspace.issues.push(issue);
  localStorage.setItem(teamKey('mw-multica-workspace-v4',teamId),JSON.stringify(workspace));
  return issue;
}
export function setDraft(key:string,text:string){updateWorkspace(s=>{if(text.trim())s.drafts[key]=text;else delete s.drafts[key]})}
export function issueUrl(id:number){return 'work.html?issue='+id+(new URLSearchParams(location.search).get('frame')==='multica'?'&frame=multica':'')}
export function projectUrl(name:string){return 'work.html?project='+encodeURIComponent(name)+(new URLSearchParams(location.search).get('frame')==='multica'?'&frame=multica':'')}
export const statuses = ['待规划','待办','进行中','已完成','已取消','阻塞'];
export const priorities = ['无优先级','紧急','高','中','低'];
export function copyText(value:string){return navigator.clipboard.writeText(value)}

window.addEventListener('storage',event=>{if(event.key===key()){state=read();listeners.forEach(fn=>fn())}});

window.addEventListener('mw-workspace-change',()=>{state=read();listeners.forEach(fn=>fn())});

window.addEventListener('mw-team-change',()=>{state=read();listeners.forEach(fn=>fn())});
