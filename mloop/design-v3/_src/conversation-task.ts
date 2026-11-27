import type {ConversationMessage} from './collaboration-store';
import {workName} from './composer-capabilities';

export const conversationTaskPrompt='@Work 请分析当前会话记录，提炼可执行事项，创建任务并关联到本会话。';

function instructionOf(text:string,who:string){
 const firstLine=text.trim().split('\n')[0];
 const mention=firstLine.startsWith('@'+workName(who))?'@'+workName(who):firstLine.match(/^@Work/i)?.[0];
 if(!mention)return '';
 const request=firstLine.slice(mention.length);
 return /^[\s，。！？,:：!；;、]/.test(request)?request.trim():'';
}

export function isConversationTaskRequest(text:string,who:string){
 const request=instructionOf(text,who);
 return /会话|聊天记录|讨论|对话/.test(request)&&/(?:创建|新建|转为|转成)[^。！？]{0,16}任务/.test(request)&&!/怎么|如何|是否|不要|不用|先别|能不能/.test(request);
}

const plain=(text:string)=>text.replace(/<[^>]*>/g,' ').replace(/^([\s>#*·-]|\d+\.\s)+/,'').replace(/[*`]/g,'').trim();
const actionable=(text:string)=>/(待办|下一步|需要|请|安排|建议|确认|修复|修正|补充|梳理|推进|完成|提交|更新|整理|实现|验证|检查)/.test(text);
const substantive=(text:string)=>!/^(?:@[^\s]+\s+)*(?:在吗|收到|谢谢|好的|好|嗯|测试|你好|hi|ok)[\s，。！？!?.]*$/i.test(text)&&(text.length>=8||text.length>=4&&actionable(text));

export function planConversationTask({messages,title,request,who}:{messages:ConversationMessage[];title:string;request:string;who:string}){
 // The resulting task is shared. Private digests must not be copied out of the chat.
 const sources=messages.filter(m=>!m.visibleTo&&m.kind!=='system'&&m.kind!=='onboarding'&&m.kind!=='task-conversion'&&m.text&&!isConversationTaskRequest(m.text,m.author));
 const instruction=instructionOf(request,who),notes=request.trim().split('\n').slice(1).join('\n').trim();
 const customInstruction=instruction===instructionOf(conversationTaskPrompt,who)?'':instruction;
 const excerpts=sources.flatMap(m=>m.text.split(/\n/).map(plain).filter(substantive).map(text=>({text,author:m.author}))).slice(-24);
 const focus=notes?notes.split('\n').map(plain).find(substantive):undefined;
 const actions=[...new Set(excerpts.filter(e=>actionable(e.text)).map(e=>e.text))].slice(-4);
 if(!excerpts.length&&!focus)return;
 const namedTopic=title&&!/^(?:新会话|协作会话|任务讨论|测试|与.+的会话)$/.test(title);
 const taskTitle=(focus||(actions.length===1?actions[0]:namedTopic?'跟进：'+title:actions[0]||'跟进：'+excerpts.at(-1)!.text)).replace(/[。！？]+$/,'').slice(0,60);
 const evidence=excerpts.slice(-4).map(e=>'- '+e.author+'：'+e.text.slice(0,220)).join('\n');
 const description=[`来自会话「${title}」。`,customInstruction||notes?'**补充要求**\n\n'+[customInstruction,notes].filter(Boolean).join('\n\n'):'',actions.length?'**待推进事项**\n\n'+actions.map(a=>'- '+a.slice(0,220)).join('\n'):'',evidence?'**讨论依据**\n\n'+evidence:''].filter(Boolean).join('\n\n');
 return {title:taskTitle,description};
}
