export const ENTRY_CATALOG=[
 {id:'invite',title:'邀请成员',description:'邀请伙伴加入当前团队，一起推进工作。',path:'团队设置 / 成员管理 / 邀请成员',action:'打开邀请成员',query:'请告诉我在哪邀请成员？',icon:'users',tone:'person',modal:'invite'},
 {id:'team-settings',title:'团队设置',description:'管理团队资料、成员和协作方式。',path:'团队设置 / 基础信息',action:'打开团队设置',query:'团队信息在哪里修改？',icon:'settings',tone:'project',modal:'general'},
 {id:'create-task',title:'创建任务',description:'明确目标与负责人，把想法推进为任务。',path:'任务 / 新建任务',action:'打开任务创建',query:'新建任务的入口在哪里？',icon:'task',tone:'project',modal:'task'},
 {id:'models',title:'模型设置',description:'管理本地模型名称样例，不会更改智能体的预配置。',path:'设置 / 模型',action:'打开模型设置',query:'在哪里配置模型？',icon:'model',tone:'person',href:'settings-models.html'},
 {id:'files',title:'我的文件',description:'查看与整理工作中的文件和交付成果。',path:'我的文件',action:'打开我的文件',query:'在哪里查看我的文件？',icon:'file',tone:'person',href:'files.html'},
] as const;
export type EntryId=typeof ENTRY_CATALOG[number]['id'];
export type EntrySurface={id:EntryId;teamId:string;teamName:string;createdAt:number};
export function recognizeEntry(text:string):EntryId|undefined{
 text=text.replace(/\s+/g,'');
 const question=/在哪|哪里|何处|如何|怎么|入口|打开|设置|管理|查看|告诉我|配置/.test(text);
 if(!question)return;
 if(/(?:邀请|添加|新增).{0,6}(?:成员|伙伴|同事)|(?:成员|伙伴|同事).{0,6}(?:邀请|添加)/.test(text))return 'invite';
 if(/(?:团队|工作区).{0,8}(?:信息|设置|资料|名称)|修改.{0,4}团队/.test(text))return 'team-settings';
 if(/模型/.test(text))return 'models';
 if(/文件/.test(text))return 'files';
 if(/(?:创建|新建).{0,4}任务|任务.{0,4}(?:创建|新建)/.test(text)&&/在哪|哪里|入口|如何|怎么/.test(text))return 'create-task';
}
export type Habit={key:string;at:number;kind:'query'|'open'|'visit'};
export type Recommendation={key:string;title:string;query:string;tone:string;icon:string;hint:string;reason?:string};
export const DEFAULT_RECOMMENDATIONS:Recommendation[]=[
 {key:'person',title:'成员最近进展',query:'查询一下当前肖叶茂最近的进展',tone:'person',icon:'person',hint:'看看最近的工作进展'},
 {key:'project',title:'项目进度概览',query:'查看当前项目的整体进度',tone:'project',icon:'project',hint:'掌握任务整体进度'},
 {key:'risk',title:'哪些事情需要关注',query:'查询当前阻塞和逾期的任务',tone:'risk',icon:'risk',hint:'跟进阻塞与逾期事项'},
];
export const RECOMMENDATION_CATALOG:Recommendation[]=[...DEFAULT_RECOMMENDATIONS,...ENTRY_CATALOG.map(e=>({key:e.id,title:e.title,query:e.query,tone:e.tone,icon:e.icon,hint:e.description}))];
export function recommendFromHabits(events:Habit[],now=Date.now()):Recommendation[]{
 const scores=new Map<string,{score:number;latest:number;count:number}>();
 for(const e of events){const age=now-e.at;if(age<0||age>30*86400000||!RECOMMENDATION_CATALOG.some(r=>r.key===e.key))continue;const item=scores.get(e.key)||{score:0,latest:0,count:0};item.score+=(e.kind==='open'?2:e.kind==='query'?1.5:1)*Math.exp(-age/(7*86400000));item.latest=Math.max(item.latest,e.at);item.count++;scores.set(e.key,item)}
 const sorted=[...scores].sort((a,b)=>b[1].score-a[1].score||b[1].latest-a[1].latest||a[0].localeCompare(b[0]));
 const ranked=sorted.map(([key,stats])=>({...RECOMMENDATION_CATALOG.find(r=>r.key===key)!,reason:stats.count>1?'您最近经常使用':'您最近使用过'}));
 return [...ranked,...DEFAULT_RECOMMENDATIONS.filter(r=>!scores.has(r.key))].slice(0,3);
}
