import {createTeam,teamKey,type TeamInfo} from './team-context';
import type {BlueprintNode,Issue,Project,Workspace} from './multica-ui/store';
import type {Conversation,ConversationMessage} from './collaboration-store';
import {ownWork} from './member-policy';

export function createLocalDemo(who:string){
 const now=new Date(), iso=now.toISOString();
 const date=(delta:number)=>{const d=new Date(now);d.setDate(d.getDate()+delta);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
 const members=[{id:'demo-owner',name:who,email:who.includes('@')?who:'owner@demo.invalid',role:'所有者'},...['杨陈皓','林知夏','林悦'].filter(name=>name!==who).slice(0,2).map((name,i)=>({id:'demo-member-'+i,name,email:`member${i+1}@demo.invalid`,role:'成员'}))];
 const [,engineer,reviewer]=members;
 const agent=(id:string,name:string,status:string,access='整个工作区')=>({id,name,status,access,runtime:'云端工作区',model:'默认模型',harness:'Codex',description:'本地样例：整理交付要求与验收结果。',instructions:'根据当前讨论整理交付清单。',color:'blue',owner:'我',runs:0});
 const agents=[agent('demo-delivery','交付整理助手','在线'),agent('demo-qa','质量验收助手','离线'),agent('demo-private','个人速记助手','在线','仅自己'),{...agent('demo-archived','已归档助手','离线'),archived:true}];
 const squad={id:'demo-squad',name:'移动端交付小队',description:'复现弱网上传问题，交付修复与回归报告。',leader:agents[0].id,owner:'我',color:'cyan',instructions:'先确认复现条件，再开始修复与回归。',members:[{id:agents[0].id,type:'agent',role:'交付整理'},{id:engineer.id,type:'human',role:'研发'},{id:reviewer.id,type:'human',role:'验收'}]};
 const project=(name:string,description:string,status:string,lead:string):Project=>({name,description,status,lead,priority:'高',start:date(-5),due:date(7),workflow:'Default',resources:[]});
 const delivery=project('移动端弱网上传','断网恢复后，相同请求不得重复创建上传记录。','进行中',who);
 const draft=project('新版发布准备','组装发布清单后再发布首版施工蓝图。','计划中',reviewer.name);
 const empty=project('体验调研','空项目，用于检查没有任务或施工蓝图时的界面。','计划中',who);
 const issue=(id:number,title:string,status:string,assignee:string,patch:Partial<Issue>={}):Issue=>({id,title,status,assignee,description:'验收要求：保留复现步骤、实际结果及交付证据。',project:delivery.name,priority:'中',createdBy:who,createdAt:iso,updatedAt:iso,subscribed:false,pinned:false,read:false,...patch});
 const issues=[
  issue(101,'确定弱网复现条件','已完成',engineer.name,{description:'断网后恢复连接，重试同一次上传并记录请求标识。',sourceConversationId:'demo-release-room',subscribed:true}),
  issue(102,'实现上传重试去重','待办',engineer.name,{priority:'高',due:date(2)}),
  issue(103,'验证重复上传回归','待规划',reviewer.name,{due:date(4)}),
  issue(104,'整理交付清单','待办',agents[0].name),
  issue(105,'排查旧版迁移异常','阻塞',who,{priority:'紧急',due:date(-2),pinned:true}),
  issue(106,'补录尚未分配的验证项','待规划','无负责人'),
  issue(107,'收集上传日志','进行中',who,{parentIssueId:102}),
  issue(108,'核对旧版埋点','已取消',reviewer.name),
  issue(109,'整理灰度发布材料','进行中',who,{project:draft.name,due:date(3)}),
  issue(110,'已归档的旧排查记录','已完成',who,{archived:true}),
  issue(111,'评审本周我负责的临时事项','待办',who,{project:'',priority:'低',subscribed:true}),
 ];
 const node=(id:number,after:number[],x:number,y:number):BlueprintNode=>{const i=issues.find(i=>i.id===id)!;return {id:'demo-node-'+id,title:i.title,description:i.description,issueId:id,after:after.map(i=>'demo-node-'+i),assignee:i.assignee,due:i.due,x,y,assigneeType:i.assignee===agents[0].name?'agent':i.assignee==='无负责人'?'':'member'};};
 delivery.blueprint={versions:[{number:1,nodes:[node(101,[],60,120),node(102,[101],380,120),node(103,[102],700,120),node(104,[101],380,350),node(105,[],60,350),node(106,[],700,350)],author:who,note:'确认复现、修复、回归和交接。',createdAt:iso}]};
 draft.blueprint={draftAuthor:who,versions:[],draft:[node(109,[],80,160),{id:'demo-draft-new',title:'发布前核查',description:'检查版本号、灰度计划和回滚路径。',after:['demo-node-109'],x:410,y:160,assignee:reviewer.name,assigneeType:'member'}]};
 const attachment={name:'弱网上传验收清单.md',type:'text/markdown',url:'data:text/markdown;charset=utf-8,'+encodeURIComponent('# 弱网上传验收清单\n\n- 断网后重连\n- 使用同一请求标识重试\n- 确认只有一条上传记录\n')};
 const workspace:Partial<Workspace>={issues,projects:[delivery,draft,empty],members,agents:agents.filter(a=>!a.archived).map(a=>({...a,expertId:a.id,visibility:a.access,online:a.status==='在线',emoji:'',skills:[]})),squads:[{...squad,expertId:squad.id,leader:agents[0].name,members:[agents[0].name,engineer.name,reviewer.name]}],comments:[{id:'demo-proof',issue:101,author:engineer.name,text:'已复现；以下是核对清单。',createdAt:iso,attachments:[attachment]}],views:[],viewLayouts:{}};
 const message=(id:string,author:string,text:string,extra:Partial<ConversationMessage>={}):ConversationMessage=>({id,author,text,time:now.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}),sentAt:iso,...extra});
 const conversations:Conversation[]=[
  {id:'demo-release-room',title:'弱网上传交付协作',project:delivery.name,members:[who,engineer.name,reviewer.name,ownWork(who),agents[0].name],issues:[101],updatedAt:iso,createdAt:iso,messages:[message('demo-1',who,'断网恢复时，同一请求只能生成一条上传记录。'),message('demo-2',engineer.name,`@${who} 已确认复现条件，请核对验收清单。`,{files:[attachment]}),message('demo-3',reviewer.name,'修复完成后，我会回归慢速连接和多次重试。')]},
  {id:'demo-private-room',title:'灰度发布私下确认',members:[who,engineer.name],issues:[],updatedAt:iso,createdAt:iso,messages:[message('demo-private-1',engineer.name,'请私下确认灰度发布的验收时间。',{files:[{name:'灰度私聊备忘.txt',type:'text/plain',url:'data:text/plain;charset=utf-8,'+encodeURIComponent('灰度验收时间待确认。')} ]})]},
 ];
 return createTeam({name:'本地演示工作区',description:'弱网上传 · 蓝图、任务与协作样例（Mock）',color:'violet',demo:true},(team:TeamInfo)=>{
  const snapshots=[['mw-multica-workspace-v4',workspace],['mw-expert-agents-v1',{agents,members,squads:[squad],tasks:[]}],['mw-conversation-journal-v2',conversations]] as const;
  const written:string[]=[];
  try{for(const [base,value] of snapshots){const key=teamKey(base,team.id)+(base==='mw-conversation-journal-v2'?':base':'');localStorage.setItem(key,JSON.stringify(value));written.push(key)}}catch(error){written.forEach(key=>localStorage.removeItem(key));throw error}
 });
}
