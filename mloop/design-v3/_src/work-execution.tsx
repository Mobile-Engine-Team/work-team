import React from 'react';
import {Search,FileText,ListTodo,Bot} from 'lucide-react';
import {DeepThinkCard} from '@/components/chat/deep-think-card';
import {CollapsibleTool,CollapsibleToolStep,CollapsibleToolTrigger,CollapsibleToolContent} from '@/components/tools/collapsible-tool';
import type {WorkExecution as Execution} from './collaboration-store';
// Preserve MobileWork's existing completion line, reasoning and inline tool rows.
// These are the original Work components, with only the local message data adapter here.
export function WorkExecution({run}:{run:Execution}){
 const labels={running:'任务执行中…',completed:'已完成',waiting:'正在准备…',failed:'执行失败',cancelled:'已停止'};
 const tools=run.steps.filter(step=>step.tool&&step.tool!=='context');
 return <div className="mw-work-process"><div className="assistant-completion">{labels[run.status]}{run.duration?' · '+run.duration:''}</div>{run.reasoning&&<DeepThinkCard stateKey={run.id+':reasoning'} text={run.reasoning} isStreaming={run.status==='running'}/>}{tools.length>0&&<div className="mw-work-tools"><CollapsibleTool>{tools.map(step=>{const Icon=step.tool==='search'?Search:step.tool==='document'?FileText:step.tool==='task'?ListTodo:Bot;return <CollapsibleToolStep key={step.id} defaultOpen={step.status==='running'}><CollapsibleToolTrigger leftIcon={<Icon size={14}/>} swapIconOnHover={false}><span>{step.title}</span></CollapsibleToolTrigger><CollapsibleToolContent><div className="mw-work-tool-output">{step.detail&&<p>{step.detail}</p>}<span>{step.status==='completed'?'已完成':step.status==='running'?'执行中':step.status==='failed'?'失败':'等待执行'}{step.duration?' · '+step.duration:''}</span></div></CollapsibleToolContent></CollapsibleToolStep>})}</CollapsibleTool></div>}{run.status==='failed'&&run.note&&<p role="status">{run.note}</p>}{run.status==='waiting'&&<p className="mw-work-waiting">正在整理这段讨论，结果会保留在当前会话。</p>}</div>
}
