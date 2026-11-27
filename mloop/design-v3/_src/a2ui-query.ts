import type {Workspace,Issue} from './multica-ui/store';

export type QueryKind='person'|'project'|'risk';
export type QuerySpec={kind:QueryKind;subject:string;days:number;status?:string};
export type QueryItem={id:number;title:string;description:string;status:string;priority:string;assignee:string;project:string;updatedAt?:string;due?:string;sample?:boolean};
export type QueryResult={spec:QuerySpec;items:QueryItem[];source:'workspace'|'sample';teamId:string;teamName:string;queriedAt:string;scanned:number;undated:number;reason?:string};
export type SurfaceComponent='ProgressHeader'|'ProgressSummary'|'ProgressMetrics'|'ProgressItems'|'ProgressActions';
export type SurfaceOperation=
 |{version:'1.0';createSurface:{surfaceId:string;catalogId:'mobilework-progress-v1'}}
 |{version:'1.0';updateDataModel:{surfaceId:string;path:'/result';value:QueryResult}}
 |{version:'1.0';updateComponents:{surfaceId:string;components:{id:string;component:SurfaceComponent;dataPath:'/result'}[]}};
export type QuerySurface={id:string;startedAt:number;result:QueryResult;operations:SurfaceOperation[];cancelledAt?:number;viewId?:string;instruction?:string};
export const QUERY_PRESETS=[
 {kind:'person',title:'成员最近进展',description:'查询一下当前肖叶茂最近的进展',hint:'进展、产出与待跟进'},
 {kind:'project',title:'项目进度概览',description:'查看当前项目的整体进度',hint:'完成情况与任务分布'},
 {kind:'risk',title:'哪些事情需要关注',description:'查询当前阻塞和逾期的任务',hint:'阻塞、逾期与优先级'},
] as const;
export const COMPONENT_ORDER:SurfaceComponent[]=['ProgressHeader','ProgressSummary','ProgressMetrics','ProgressItems','ProgressActions'];
export const STREAM_TIMES=[500,1250,2100,3050,4150,5050,5550];
export const isDone=(i:QueryItem)=>['已完成','完成','Done','Completed','已取消','取消'].includes(i.status);
export const isOverdue=(i:QueryItem,now:string)=>!!i.due&&!isDone(i)&&i.due.slice(0,10)<new Date(now).toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
export const isRisk=(i:QueryItem,now:string)=>i.status==='阻塞'||isOverdue(i,now);
const samePerson=(a:string,b:string)=>a===b||b==='肖叶茂'&&a==='xym';
export function recognizeQuery(text:string,data:Workspace,who:string):QuerySpec|undefined{
 const clean=text.replace(/@(?:MobileWork|Work)\s*/gi,'').trim();
 if(/创建|新建|分配|帮我写|生成文档/.test(clean))return;
 const days=/30\s*天|本月/.test(clean)?30:/全部|所有时间/.test(clean)?0:7;
 if(/阻塞|逾期|风险|需要关注|卡住|卡点/.test(clean))return {kind:'risk',subject:data.projects.find(p=>clean.includes(p.name))?.name||data.issues.find(i=>i.project&&clean.includes('「'+i.project+'」'))?.project||clean.match(/「([^」]+)」/)?.[1]||'待关注事项',days:/近|最近|本月/.test(clean)?days:0};
 if((/项目|「/.test(clean)||data.projects.some(p=>clean.includes(p.name)))&&/进展|进度|概览|情况|还剩|怎么样/.test(clean))return {kind:'project',subject:data.projects.find(p=>clean.includes(p.name))?.name||data.issues.find(i=>i.project&&clean.includes('「'+i.project+'」'))?.project||clean.match(/「([^」]+)」/)?.[1]||data.projects[0]?.name||'当前项目',days:/近|最近|本月/.test(clean)?days:0};
 if(/进展|进度|最近.*(工作|动态)|工作.*情况/.test(clean)){
  const known=[...new Set(['肖叶茂',who,...data.members.map(m=>m.name),...data.issues.map(i=>i.assignee)])].filter(Boolean).sort((a,b)=>b.length-a.length).find(n=>clean.includes(n));
  const extracted=clean.match(/(?:查询一下|查询|看看|查看|查一下|总结一下|总结)\s*(?:当前)?\s*(.{2,12}?)(?:的?最近|的?近[730]|的进展|的工作)/)?.[1]?.trim();
  return {kind:'person',subject:known||(/我的|我最近/.test(clean)?who:extracted)||who,days};
 }
}
export function refineQuery(text:string,previous:QuerySpec,data:Workspace,who:string):QuerySpec{
 const statusOnly=/(?:只看|仅看|只显示|筛选|状态为)\s*(已完成|进行中|待办|待规划|阻塞|审核中|已取消)/.test(text);
 const recognized=statusOnly?undefined:recognizeQuery(text,data,who),next={...previous,...recognized};
 const days=text.match(/(?:近|最近|改为|改成|过去)?\s*(\d+)\s*天/);
 if(days)next.days=Math.min(3650,Math.max(1,Number(days[1])));
 else if(/全部记录|所有时间|不限时间/.test(text))next.days=0;
 else if(/本月|一个月/.test(text))next.days=30;
 else if(/本周|一周/.test(text))next.days=7;
 else if(recognized)next.days=previous.days;
 const status=text.match(/(?:只看|仅看|只显示|筛选|状态为)\s*(已完成|进行中|待办|待规划|阻塞|审核中|已取消)/)?.[1];
 if(status)next.status=status;
 else if(/全部状态|所有状态|取消状态筛选/.test(text))delete next.status;
 return next;
}
export function queryWorkspace(spec:QuerySpec,data:Workspace,team:{id:string;name:string}):QueryResult{
 const queriedAt=new Date().toISOString();
 const all=data.issues.filter(i=>!i.archived);
 const matched=all.filter(i=>spec.kind==='person'?samePerson(i.assignee,spec.subject):spec.kind==='project'?(spec.subject==='当前项目'||(i.project||'未关联项目')===spec.subject):spec.subject==='待关注事项'||(i.project||'未关联项目')===spec.subject);
 const candidates:QueryItem[]=matched.map((i:Issue)=>({id:i.id,title:i.title,description:i.description,status:i.status,priority:i.priority,assignee:i.assignee,project:i.project,updatedAt:i.updatedAt||i.createdAt,due:i.due}));
 const items=candidates.filter(i=>spec.kind!=='risk'||isRisk(i,queriedAt)).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
 return {spec,items,source:'workspace',teamId:team.id,teamName:team.name,queriedAt,scanned:all.length,undated:items.filter(i=>!i.updatedAt||!Number.isFinite(Date.parse(i.updatedAt))).length};
}
export function createQuerySurface(spec:QuerySpec,data:Workspace,team:{id:string;name:string}):QuerySurface{
 const result=queryWorkspace(spec,data,team),id='progress-'+crypto.randomUUID();
 return {id,startedAt:Date.now(),result,operations:[
  {version:'1.0',createSurface:{surfaceId:id,catalogId:'mobilework-progress-v1'}},
  {version:'1.0',updateDataModel:{surfaceId:id,path:'/result',value:result}},
  ...COMPONENT_ORDER.map((component,index)=>({version:'1.0' as const,updateComponents:{surfaceId:id,components:[{id:'section-'+index,component,dataPath:'/result' as const}]}})),
 ]};
}
// Only our catalog and known data binding are accepted by this local renderer.
export function applySurfaceOperations(operations:SurfaceOperation[],count:number){
 let surfaceId='',result:QueryResult|undefined;const components:SurfaceComponent[]=[];
 for(const op of operations.slice(0,count)){
  if(op.version!=='1.0')continue;
  if('createSurface'in op&&op.createSurface.catalogId==='mobilework-progress-v1')surfaceId=op.createSurface.surfaceId;
  if('updateDataModel'in op&&op.updateDataModel.surfaceId===surfaceId&&op.updateDataModel.path==='/result')result=op.updateDataModel.value;
  if('updateComponents'in op&&op.updateComponents.surfaceId===surfaceId)for(const c of op.updateComponents.components)if(COMPONENT_ORDER.includes(c.component)&&c.dataPath==='/result'&&!components.includes(c.component))components.push(c.component);
 }
 return {surfaceId,result,components};
}
export function visibleItems(result:QueryResult,days:number){
 const cutoff=Date.parse(result.queriedAt)-days*86400000;
 return result.items.filter(i=>(!days||!!i.updatedAt&&Date.parse(i.updatedAt)>=cutoff)&&(!result.spec.status||i.status===result.spec.status));
}
