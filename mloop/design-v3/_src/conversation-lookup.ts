import type {Conversation} from './collaboration-store';
import type {Workspace} from './multica-ui/store';
import {conversationUrl} from './collaboration-store';
import {teamUrl} from './team-context';
import {noticeAnchor} from './notifications';
const plain=(s:string)=>s.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').trim();
export const isConversationLookup=(text:string)=>!/创建|新建|帮我写|生成文档/.test(text)&&/查找|查一下|找一下|检索|汇总|总结|回顾|(?:有哪些|列出|查看|梳理|整理).*(?:任务|待办|结论)|^(?:当前|本周|今天|最近)?(?:待办|关键结论|哪些任务)[?？。！!]*$/.test(text.trim());
// The same local Work execution path renders these grounded replies as chat messages.
export function conversationLookup(text:string,source:Conversation,data:Workspace,who:string):string|undefined{
 if(!source.members.includes(who)||!isConversationLookup(text))return;
 const terms=text.replace(/@[^\s]+/g,' ').replace(/帮我|给我|请你|请|一下|对话|会话|群聊|聊天|消息|记录|内容|历史|这段|这个|本次|关键|结论|做个|进行/g,' ').replace(/(?:最近|近)\s*\d+\s*天|本周|今天|本月/g,' ').replace(/查找|查一下|找一下|检索|汇总|总结|关键结论|回顾|讨论|任务|最近|的|请|帮我|一下|当前|待办|哪些|全部|所有/g,' ').split(/[\s，。？「」]+/).filter(Boolean);
 const days=/今天/.test(text)?1:/30\s*天|本月/.test(text)?30:/本周|近\s*7\s*天|最近/.test(text)?7:0;
 const visible=source.messages.filter(m=>(!m.visibleTo||m.visibleTo===who)&&m.kind!=='system'&&m.kind!=='onboarding'&&!/^\s*(?:@[^\s]+\s*)?(?:请|帮我|给我)?\s*(?:总结|汇总|回顾|查找|查一下|找一下|检索)/.test(m.text)&&!(m.execution&&isConversationLookup(m.execution.demo?.prompt||''))&&m.text&&(!days||!!m.sentAt&&Date.now()-Date.parse(m.sentAt)<=days*86400000));
 if(/任务|待办/.test(text)){
  const projects=[source.project,...source.messages.flatMap(m=>m.surface&&['project','risk'].includes(m.surface.result.spec.kind)?[m.surface.result.spec.subject]:[])].filter(Boolean);
  const tasks=data.issues.filter(i=>!i.archived&&(source.issues.includes(i.id)||projects.includes(i.project))&&(!/待办|未完成/.test(text)||!['已完成','已取消'].includes(i.status))&&(!terms.length||terms.some(t=>(i.title+' '+i.assignee).includes(t))));
  return tasks.length?'找到 '+tasks.length+' 项与「'+source.title+'」相关的任务：\n\n'+tasks.map(i=>'- ['+i.title+']('+teamUrl('work.html?issue='+i.id)+') · '+i.status+' · '+i.assignee).join('\n'):'这段会话关联的任务中暂时没有匹配结果。可以补充任务名称或负责人，我继续帮你查找。';
 }
 const matches=visible.filter(m=>!terms.length||terms.some(t=>plain(m.text).includes(t)));
 const conclusions=matches.filter(m=>/确认|决定|结论|同意|确定|采用/.test(m.text));
 const chosen=/结论/.test(text)?conclusions:matches;
 if(!chosen.length)return '在「'+source.title+'」'+(days?'最近 '+days+' 天':'')+'的可见记录中没有找到相关内容。可以换个关键词或指定时间范围。';
 const quote=(m:typeof chosen[number])=>'- '+m.author+'：'+plain(m.text).slice(0,420)+' [查看原消息]('+conversationUrl(source.id)+'#'+noticeAnchor('message:'+source.id+':'+m.id)+')';
 return /结论/.test(text)?'### 已确认的关键结论\n\n'+chosen.slice(-8).map(quote).join('\n\n'):'已回顾「'+source.title+'」'+(days?'最近 '+days+' 天':'')+'的 '+matches.length+' 条相关讨论。\n\n### 讨论概览\n\n'+matches.slice(-6).map(quote).join('\n\n')+'\n\n### 关键结论\n\n'+(conclusions.length?conclusions.slice(-4).map(quote).join('\n\n'):'暂未识别到明确确认的结论，可以继续补充你关注的话题。');
}
