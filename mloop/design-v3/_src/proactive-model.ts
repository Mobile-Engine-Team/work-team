import {isDone,isRisk} from './a2ui-query';
import type {Habit} from './a2ui-entry-model';
export type Insight={id:string;title:string;summary:string;evidence:string[];query:string;tone:'risk'|'progress'|'planning';score:number;sample?:boolean};
export function analyzeNextSteps(data:any,conversations:any[],who:string,habits:Habit[],now=new Date().toISOString()):Insight[]{
 const issues=data.issues.filter(i=>!i.archived),projects=[...new Set(issues.map(i=>i.project||'未关联项目'))] as string[];
 const result:Insight[]=[];
 for(const project of projects){const rows=issues.filter(i=>(i.project||'未关联项目')===project),risks=rows.filter(i=>isRisk(i,now)),done=rows.filter(isDone),open=rows.filter(i=>!isDone(i));
 const recent=conversations.filter(c=>c.members.includes(who)&&(c.project===project||c.messages.some(m=>m.author===who&&m.text?.includes(project)))).length;
 const mine=rows.filter(i=>i.assignee===who||who==='肖叶茂'&&i.assignee==='xym').length;
 const interest=recent*3+mine*2+(habits.some(h=>h.key==='risk')?2:0);
 if(risks.length)result.push({id:'risk:'+project+':'+risks.map(i=>i.id+'='+i.status+'='+i.due).sort().join(','),title:project+'可能需要您关注',summary:`发现 ${risks.length} 项阻塞或逾期事项，是否先看看对项目的影响？`,evidence:[`当前 ${rows.length} 项任务中，${risks.length} 项需要跟进`,recent?`您曾在 ${recent} 段会话中关注此项目`:mine?`其中 ${mine} 项任务由您负责`:'来自当前协作区任务状态'],query:`帮我看看「${project}」有没有卡住的事情`,tone:'risk',score:10+risks.length*2+interest});
 if(done.length&&done.length/rows.length>=.6)result.push({id:'close:'+project,title:project+'接近收尾了',summary:`已有 ${done.length} 项完成，或许可以提前梳理验收和剩余事项。`,evidence:[`完成 ${done.length}/${rows.length} 项任务`,open.length?`仍有 ${open.length} 项未结束`:'全部事项已结束，可回顾交付'],query:`帮我看看「${project}」现在进展怎么样`,tone:'progress',score:7+interest});
 const missing=open.filter(i=>!i.assignee||['无负责人','未分配'].includes(i.assignee));
 if(missing.length)result.push({id:'owner:'+project,title:project+'还有事项等待认领',summary:`有 ${missing.length} 项未完成任务尚未指定负责人，可能影响下一步推进。`,evidence:[`${missing.length} 项待办缺少负责人`,`当前项目共有 ${rows.length} 项任务`],query:`帮我看看「${project}」现在进展怎么样`,tone:'planning',score:6+missing.length+interest});
 }

 return result.sort((a,b)=>b.score-a.score);
}
