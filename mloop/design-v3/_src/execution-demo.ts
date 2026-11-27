import {currentTeam} from './team-context';
import {upgradeResponse} from './upgrade-response';
import type {WorkExecution,TaskProposal} from './collaboration-store';

export type DemoRequest={startedAt:number;simulateFailure?:boolean;prompt:string;topic:string;context?:string;participants?:string[];files?:string[]};
const clean=(s:string)=>s.replace(/<[^>]*>/g,' ').replace(/@[^@\n，。！？,:：!；;]*?(?:的\s*Work\s*助手)\s*/gi,'').replace(/@(?:work|MobileWork)\b/gi,'').replace(/@[^@\s]+/g,'').replace(/\s+/g,' ').trim();
export function demoRun(prompt:string,topic:string,context='',participants:string[]=[],files:string[]=[]):WorkExecution{
 return progressDemo({id:crypto.randomUUID(),status:'running',example:true,steps:[],demo:{startedAt:Date.now(),simulateFailure:currentTeam().demo===true&&prompt.includes("【模拟失败】"),prompt,topic,context,participants,files}});
}
export function progressDemo(run:WorkExecution):WorkExecution{
 if(!run.demo)return run;
 const elapsed=Date.now()-run.demo.startedAt,phase=elapsed<1000?0:elapsed<2300?1:elapsed<4200?2:3;
 const text=clean(run.demo.prompt),research=/调研|研究|cursor|进展|对比|邮件/i.test(text),document=/文档|需求|整理|汇总|总结|报告/.test(text);
 const lookup=/^与 Work 回顾/.test(run.demo.topic)&&/查找|查一下|找一下|检索|汇总|总结|回顾|结论|待办/.test(text);
 const titles=lookup?['读取当前会话上下文','检索讨论与关联任务','整理回答与消息来源']:['读取任务与讨论上下文',research?'梳理关注点与参考方向':'分析目标与协作分工',document?'生成文档与交付清单':'整理方案与验收标准'];
 if(run.demo.simulateFailure&&phase===3)return {...run,status:'failed',note:'本地模拟失败：未产生交付物。删除【模拟失败】后重新发送可体验成功路径。',steps:titles.map((title,i)=>({id:run.id+':'+i,title,tool:i===0?'context':i===1?'task':'document',status:i===2?'failed':'completed'}))};
 return {...run,status:phase===3?'completed':'running',duration:phase===3?'4.2 秒':undefined,example:true,steps:titles.map((title,index)=>({id:run.id+':'+index,title,tool:index===0?'context':index===1?(research?'search':'task'):'document',status:phase>index?'completed':phase===index?'running':'pending',detail:index===0?'当前主题：'+run.demo!.topic:index===1?'根据当前讨论整理目标、实现范围和待确认事项。':'产出可继续讨论的方案，并保留到当前记录。'}))};
}
export function demoResult(request:DemoRequest):{text:string;document?:{name:string;url:string};proposals?:TaskProposal[]}{
 const prompt=clean(request.prompt),source=request.context||'',all=prompt+' '+request.topic+' '+source;
 const cursor=/cursor|mobilecoder|逆向/i.test(all),topic=cursor?'Cursor 能力在 MobileCoder 中的落地':request.topic==='新会话'?(prompt.slice(0,36)||'本次协作'):request.topic;
 const members=(request.participants||[]).filter(n=>!/的\s*Work\s*助手$/i.test(n));
 const tasks=/创建.{0,8}任务|拆.{0,6}任务|指派|分配任务/.test(prompt);
 let text:string;
 const upgrade=upgradeResponse(prompt,all);
 if(upgrade)text=upgrade;
 else if(/邮件|邮箱/.test(prompt))text='这里是一组用于演示的邮件摘要：\n\n- **产品团队 · 需求评审与材料确认**：核对本周需求范围和验收标准。\n- **研发团队 · 协作能力联调**：确认接口负责人和联调时间。\n- **项目负责人 · 周报与风险同步**：汇总当前进展和阻塞项。\n\n建议先确认评审材料，再安排联调。以上为模拟邮件，未读取真实邮箱。';
 else if(/^(你好|hello|hi\b|在吗|能做什么|你是谁)/i.test(prompt))text='你好，我可以和你一起梳理需求、调研方案、整理文档，也可以把讨论拆成协作任务。\n\n你可以直接告诉我目标，或把任务和资料发过来；在群里 @ 我，就能基于当前讨论继续处理。';
 else if(/总结|汇总|上下文|进展|报告/.test(prompt)&&!cursor){
  const excerpts=source.split('\n').map(s=>s.trim()).filter(Boolean).slice(-4);
  text='已围绕「'+topic+'」整理了一版讨论摘要。\n\n### 当前上下文\n'+(excerpts.length?excerpts.map(s=>'- '+s.slice(0,160)).join('\n'):'- 本轮目标：'+(prompt||topic))+'\n\n### 下一步\n1. 确认本轮交付范围与负责人。\n2. 把待确认事项补充到当前任务，保留讨论依据。\n3. 按验收清单逐项检查，再同步最终结论。'+(members.length?'\n\n建议由 '+members.slice(0,3).join('、')+' 一起确认范围与分工。':'');
 }else if(cursor){
  text='我先结合当前任务，整理了一版「'+topic+'」的方案，供大家继续评审。\n\n### 建议优先落地的能力\n- **上下文管理**：引用需求、文件及历史讨论，切换入口后仍可追溯。\n- **智能体执行过程**：展示分析、处理步骤与产出，单聊、群聊和任务动态都可查看。\n- **多人协作与分工**：@ 成员对齐，@ 智能体执行；评论保留在任务，提醒跳回原文。\n- **变更与成果确认**：汇总方案和产物，每项交付都有明确验收标准与确认人。\n\n### 实施安排\n1. **先对齐范围**：确认本轮优先场景、输入资料和验收方式。\n2. **再做一条完整流程**：讨论需求 → 智能体处理 → 产出方案 → 成员确认。\n3. **最后补齐边界**：测试多页面同步、刷新恢复和多人同时操作。\n\n### 待确认\n- 本轮优先覆盖桌面端还是移动端？\n- 第一阶段选择哪两个能力做完整演示？\n\n这是一份基于当前上下文生成的演示方案，未进行真实联网调研或代码修改。';
 }else{
  text='收到。我围绕「'+topic+'」整理了第一版处理方案。\n\n### 本轮目标\n'+(prompt||topic)+'\n\n### 建议的处理步骤\n1. **明确范围**：整理现状、目标用户与本轮必须交付的内容。\n2. **形成方案**：沿用当前 Work 的界面与交互，让入口、状态和反馈保持一致。\n3. **落实协作**：把需要确认的问题留在当前任务，由相关成员逐项反馈。\n4. **完成验收**：检查主流程、异常状态、多页面同步和刷新恢复。\n\n### 交付与验收\n- 交付一份需求说明、流程清单和待确认事项。\n- 每项需求明确负责人、完成条件与依赖。\n- 智能体执行过程和结果保留在当前讨论中，便于继续追问。'+(request.files?.length?'\n\n已记录附件：'+request.files.join('、')+'。演示中仅使用附件名称，未解析其内容。':'');
 }
 if(tasks)text+='\n\n我把方案拆成了下面的任务草稿，可以调整负责人后创建到当前项目。';
 const doc=/文档|需求|整理|汇总|总结|报告|调研/.test(prompt)||cursor;
 const name=(topic.replace(/[\\/:*?"<>|]/g,'').slice(0,45)||'协作方案')+' · 方案.md';
 const taskName=prompt.replace(/^(请|帮我|麻烦|可以|一下|创建|新建|一个|一条|任务|：|:|\s)+/g,'').trim();
 const proposals=tasks?( /拆|分解|分配/.test(prompt)?['确认范围与交付','推进关键事项','检查结果与验收']:[taskName||'跟进本轮讨论']).map((title,index)=>({id:'demo-proposal-'+index,title:/拆|分解|分配/.test(prompt)?topic+' · '+title:title,description:'根据当前讨论推进：'+title+'。\n\n验收：有明确产出，相关成员完成确认。',assignee:members[index%Math.max(1,members.length)]||'无负责人',project:''})):undefined;
 return {text,document:doc?{name,url:'data:text/markdown;charset=utf-8,'+encodeURIComponent('# '+topic+'\n\n> 演示模拟产出\n\n'+text)}:undefined,proposals};
}
