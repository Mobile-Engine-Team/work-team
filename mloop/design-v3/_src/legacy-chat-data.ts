import type {WorkExecution as Execution} from './collaboration-store';
type Member={id:string;name:string;role:string;color:string;job:string;online:boolean;bot?:boolean;avatar?:string};
type Message={id:number;member:string;time:string;date:string;text?:string;file?:string;size?:string;image?:string;reaction?:string;reply?:string;execution?:Execution;fileUrl?:string};
export const seedMembers:Member[]=[
{id:'me',name:'肖叶茂',role:'群主',color:'blue',job:'产品负责人',online:true},
{id:'yang',name:'杨陈皓',role:'管理员',color:'violet',job:'产品设计',online:true},
{id:'lin',name:'林知夏',role:'成员',color:'green',job:'前端开发',online:true},
{id:'chen',name:'陈一鸣',role:'成员',color:'orange',job:'测试工程师',online:false},
{id:'zhou',name:'周可',role:'成员',color:'rose',job:'体验设计',online:false},
{id:'bot',name:'Work 助手',role:'智能体',color:'blue',job:'整理讨论 · 协作助手',online:true,bot:true},
];
const candidates:Member[]=[...seedMembers.filter(m=>m.id!=='me').map(m=>({...m,role:m.bot?'智能体':'成员'})),{id:'li',name:'李越川',role:'成员',color:'violet',job:'后端开发',online:false},{id:'gu',name:'顾雪妍',role:'成员',color:'green',job:'产品运营',online:true},{id:'zhang',name:'张智涵',role:'成员',color:'orange',job:'测试工程师',online:false}];
export const seedMessages:Message[]=[
{id:1,member:'yang',time:'16:42',date:'2026-11-08',text:'把测试群建好了，后续的体验问题和设计反馈都在这里同步。'},
{id:2,member:'lin',time:'16:45',date:'2026-11-08',text:'收到！我整理了第一版测试清单，明天一起过一下。',file:'Work 群聊测试清单.xlsx',size:'28.6 KB'},
{id:3,member:'yang',time:'10:24',date:'2026-11-09',text:'早上好 👋 群聊第一版的设计已经整理好了，大家可以先看一下。'},
{id:5,member:'me',time:'10:28',date:'2026-11-09',text:'整体方向可以 👍\n@林知夏 重点看一下输入框的多种消息类型，以及 @成员的交互。'},
{id:6,member:'lin',time:'10:30',date:'2026-11-09',reply:'肖叶茂：重点看一下输入框的多种消息类型…',text:'收到，文本、表情、图片和文件都会覆盖。测试用例也更新到这个文档里了。',file:'群聊功能测试用例 v1.2.pdf',size:'2.4 MB'},
{id:7,member:'bot',time:'10:31',date:'2026-11-09',text:'已整理本轮关注点：\n1. 多种消息类型与 @成员\n2. 群信息编辑与成员管理\n3. 聊天记录查看与搜索'},
{id:4,member:'yang',time:'10:32',date:'2026-11-09',image:'assets/group-chat-preview.svg',text:'这版延续了 Work 的浅蓝色和留白，群信息可以在右侧直接查看。'},
{id:8,member:'chen',time:'10:33',date:'2026-11-09',text:'我下午补一轮测试，结果直接同步在群里。👌',reaction:'👍  2'},
{id:9,member:'me',time:'10:35',date:'2026-11-09',text:'收到，下午一起验收。@陈一鸣 结果和问题截图直接同步在群里 👍'},
];
export function squadMembers(source:any):Member[]{return source.members.map(m=>({id:m.id,name:m.entity.name,role:m.id===source.squad.leader?'队长':m.type==='agent'?'智能体':'成员',color:m.entity.color||'blue',job:m.role||m.entity.description||'小队成员',online:m.type==='human'||m.entity.status==='在线',bot:m.type==='agent',avatar:m.entity.avatar}))}
export function squadMessages(source:any,members:Member[]):Message[]{
 const leader=members.find(m=>m.id===source.squad.leader)||members[0],other=members.find(m=>m.id!==leader?.id&&m.bot),focus=source.members.find(m=>m.id===other?.id)?.role;
 return [{id:1,member:'me',date:'2026-11-09',time:'10:20',text:'大家早上好 👋 我们在这里同步小队的工作进展，先帮我整理一下今天的安排。'},
 ...(leader?[{id:2,member:leader.id,date:'2026-11-09',time:'10:21',text:'收到。我们按「'+source.squad.name+'」的分工推进，我会先明确目标、协调成员，再统一汇总进展。\n\n'+(source.squad.instructions||'请把这次需要协作的目标和资料发到群里，我们一起梳理工作步骤。')}]:[]),
 ...(other?[{id:3,member:other.id,date:'2026-11-09',time:'10:23',text:focus?'我会负责'+focus+'。收到资料后，我会先整理重点，再把结果同步到这个群聊。':'收到，我会先整理相关资料，明确当前工作的重点和下一步安排，再把结果同步到这个群聊。'}]:[]),
 {id:4,member:'me',date:'2026-11-09',time:'10:25',text:'好的，按小队现有的职责和配置推进。有需要确认的事项，直接在这里 @我。👍'},
 ...(leader?[{id:5,member:leader.id,date:'2026-11-09',time:'10:26',text:'明白。我会持续汇总各成员的进展，将待确认事项和下一步安排一起发到群里。'}]:[])];
}
