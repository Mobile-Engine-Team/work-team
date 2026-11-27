import {currentTeam,teams} from './team-context';

export function expertTeamSeed(base:any,teamId:string=currentTeam().id){
  const state=structuredClone(base);
  if(!['product','brand'].includes(teamId)){const creator=teams.find(t=>t.id===teamId)?.creator;return {...state,agents:[],squads:[],tasks:[],members:[{id:'me',name:creator||'肖叶茂',email:creator?(creator.includes('@')?creator:'owner@'+teamId+'.invalid'):'xiaoyemao@example.com',role:'所有者'}]};}
  if(teamId!=='brand')return state;
  state.agents=state.agents.filter(a=>['writer','analyst','product'].includes(a.id));
  state.agents.sort((a,b)=>['writer','analyst','product'].indexOf(a.id)-['writer','analyst','product'].indexOf(b.id));
  state.agents.find(a=>a.id==='product').name='选题策划助手';
  state.members.push({id:'editor',name:'许知夏',email:'zhixia@example.com',role:'成员'});
  state.squads=state.squads.filter(s=>s.id==='content');
  state.squads[0].name='品牌内容小队';
  state.squads[0].members.push({id:'analyst',type:'agent',role:'内容效果分析'},{id:'editor',type:'human',role:'渠道运营与发布'});
  state.tasks=[];
  return state;
}
export function workspaceTeamSeed(base:any,teamId:string=currentTeam().id){
  const state=structuredClone(base);
  if(!['product','brand'].includes(teamId))return {...state,issues:[],comments:[],chatMessages:[],drafts:{},projects:[],agents:[],squads:[],skills:[],views:[],viewLayouts:{},invitations:[],issueCreationRequests:[],members:[{name:'肖叶茂',email:'xiaoyemao@example.com',role:'所有者'}]};
  if(teamId!=='brand')return state;
  const titles=['确认双十一品牌专题选题','完成新品发布长图文案','整理十月内容效果复盘','排期本周社媒发布内容'];
  state.issues=titles.map((title,i)=>({id:101+i,title,description:['围绕用户真实场景筛选选题，周三完成选题评审。','统一新品卖点与品牌语气，提交渠道适配版本。','汇总阅读、互动和转化数据，形成下一阶段建议。','确认图文素材、渠道和发布时间。'][i],project:'品牌内容计划',status:['进行中','待办','已完成','待规划'][i],priority:i===0?'高':'中',assignee:['选题策划助手','内容创作助手','数据分析助手','林悦'][i],actor:'林悦',subscribed:true,pinned:false,read:i>1,ago:i===0?'20 分钟':'今天'}));
  state.projects=[{...state.projects[0],name:'品牌内容计划',description:'品牌内容与渠道运营',lead:'林悦'}];
  state.agents=[['内容创作助手','文案创作'],['数据分析助手','数据分析'],['选题策划助手','需求分析']].map(([name,skill])=>({...base.agents[0],name,description:'协助团队完成'+skill+'与内容交付。',skills:[skill],runs:8}));
  state.members=[{name:'肖叶茂',email:'xiaoyemao@example.com',role:'成员'},{name:'林悦',email:'linyue@example.com',role:'管理员'},{name:'许知夏',email:'zhixia@example.com',role:'成员'}];
  state.squads=[{name:'品牌内容小队',description:'内容策划、创作与效果分析',leader:'内容创作助手',members:['内容创作助手','数据分析助手','林悦','许知夏']}];
  state.comments=[];state.chatMessages=[];state.drafts={};state.views=[];state.viewLayouts={};state.invitations=[];
  return state;
}
export const teamGroupNames=(base:string[])=>currentTeam().id==='product'?base:[];
