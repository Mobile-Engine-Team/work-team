import React,{useState,useEffect} from 'react';
import {Check,ChevronDown,ChevronRight,Play,Users,X,ArrowUpRight} from 'lucide-react';
import {currentTeam,teamKey,useTeam,teamUrl} from './team-context';
import {setIdentity,useIdentity} from './local-identity';
import {useWorkspace,getWorkspace,updateWorkspace} from './multica-ui/store';
import {readExpertWorkspace} from './agent-workspace';
import {getConversations,useConversations,newConversation,saveConversation,getConversation,appendConversationMessage,sendConversationMessage,conversationUrl} from './collaboration-store';
import {ownWork} from './member-policy';
import {INVITATION_TEST_MEMBERS as PEOPLE} from './invitation-test-members';
import './upgrade-walkthrough.css';
const PROJECT='Work 软件升级';
const AGENT='Work 升级研究助手';
const STAGES=[
 ['邀请协作伙伴','先邀请产品杨陈皓、研发林知夏和负责人林悦。邀请记录会出现在空间成员管理中。','创建成员邀请'],
 ['同事接受邀请','切换演示视角，让三位同事接受邀请，加入当前空间。','同事接受邀请'],
 ['创建升级研究助手','配置需求分析、数据分析能力，明确调研范围、交付物和验收标准。','创建智能体'],
 ['先和 Work 聊聊','提出升级目标，Work 帮您把想法梳理成范围、交付与待确认事项。','发送初步想法'],
 ['与同事确认目标','邀请同事进入同一会话，由产品确认范围，研发说明实施边界，负责人确认验收要求。','一起确认目标'],
 ['把讨论变成任务','生成四项任务草稿。请在消息卡片中点击「创建全部任务」，负责人和项目会一并带入。','生成任务草稿'],
 ['在任务下协作','进入 Demo 搭建任务，在动态中同步调研成果、研发安排及验收口径。','进入任务并协作'],
 ['领导查询项目进展','切换林悦视角，向自己的 Work 询问项目。卡片逐步生成，数据来自刚才创建的真实本地任务。','领导查看进展'],
 ['继续工作，出现新情况','回到肖叶茂，研发发现旧版登录态兼容性问题。更新实际任务状态，让 Work 从后台发现变化。','同步兼容性阻塞'],
 ['让 Work 多想一步','继续看任务或聊天，稍等右下角自动提醒。点击「一起看一下」会开启风险查询；这里无需手动触发提醒。','已查看提醒，安排跟进'],
 ['跟进风险，再查一次','落实兼容处理与验收口径，解除阻塞，再用领导视角查询最新状态，验证卡片随数据更新。','完成跟进并复查'],
 ['全流程已完成','成员、智能体、讨论、任务、进展卡片和风险跟进均保存在这个协作空间。可继续操作，也可开启新一轮演示。','查看项目任务'],
];
const key=()=>teamKey('mw-upgrade-walkthrough');
function read(){try{return JSON.parse(localStorage.getItem(key())||'null')}catch{return null}}
function remember(patch:any){const next={...read(),...patch};localStorage.setItem(key(),JSON.stringify(next));window.dispatchEvent(new Event('mw-upgrade-step'));return next}
function clock(){return new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}
function message(id:string,author:string,text:string,kind?:string){appendConversationMessage(id,{id:crypto.randomUUID(),author,text,time:clock(),kind})}
function expertSave(fn:(state:any)=>void){const state=structuredClone(readExpertWorkspace());fn(state);localStorage.setItem(teamKey('mw-expert-agents-v1'),JSON.stringify(state));window.dispatchEvent(new Event('mw-expert-change'))}
function go(url:string){location.href=url}
function projectSetup(){updateWorkspace(w=>{if(!w.projects.some(p=>p.name===PROJECT))w.projects.push({name:PROJECT,description:'完成软件升级调研、交互 Demo 与兼容性验证。',status:'进行中',priority:'高',lead:'肖叶茂',start:new Date().toISOString().slice(0,10),due:'',workflow:'Default',resources:[]});if(!w.members.some(m=>m.name==='肖叶茂'))w.members.push({name:'肖叶茂',email:'xiaoyemao@example.com',role:'所有者'})})}
function proposalSpecs(){return [
 {id:'upgrade-research',title:'完成 Work 升级场景与能力调研',assignee:'杨陈皓',description:'对比当前 Work 的会话、任务与智能体协作路径，输出三项升级建议。\n验收：场景对照、能力取舍、引用来源齐全。'},
 {id:'upgrade-scope',title:'确认升级范围与 Demo 验收清单',assignee:'肖叶茂',description:'确认本轮只覆盖统一会话、任务协作、进展卡片和主动提醒。\n验收：负责人林悦确认范围，列明暂不覆盖的真实服务。'},
 {id:'upgrade-build',title:'搭建 Work 升级交互 Demo',assignee:'林知夏',description:'串联邀请、创建智能体、会话、任务、进展查询与主动提醒。\n验收：主流程可点击，刷新保留数据，卡片渐进生成。'},
 {id:'upgrade-compat',title:'验证旧版登录态与升级兼容性',assignee:'肖叶茂',description:'检查旧版登录态能否平滑进入新会话，明确兼容方案与回退路径。\n验收：兼容清单完整，阻塞解除后由产品与研发共同确认。'},
 ].map(p=>({...p,project:PROJECT}))}
function proposalIssues(s:any){return getConversation(s.group)?.messages.find(m=>m.id==='upgrade-task-plan')?.proposals||[]}
function patchIssue(id:number,patch:any){updateWorkspace(w=>{const i=w.issues.find(i=>i.id===id);if(i)Object.assign(i,patch,{updatedAt:new Date().toISOString()})})}
function taskComment(issue:number,author:string,text:string){updateWorkspace(w=>w.comments.push({id:crypto.randomUUID(),issue,author,text,createdAt:new Date().toISOString()}))}
function queryProgress(s:any,title:string){setIdentity('林悦');let c=s.leader&&getConversation(s.leader);if(!c){c=newConversation({title:'Work 升级进展',project:PROJECT});remember({leader:c.id})}sendConversationMessage(c.id,title,[],getWorkspace());return c}
async function advance(s:any,agentName:string){
 projectSetup();
 switch(s.step){
 case 0:{updateWorkspace(w=>{for(const p of PEOPLE)if(!w.invitations.some(i=>i.email===p.email))w.invitations.push({id:crypto.randomUUID(),email:p.email,role:p.role})});remember({step:1});window.dispatchEvent(new CustomEvent('mw-open-team-settings',{detail:{tab:'members'}}));break}
 case 1:{updateWorkspace(w=>{for(const p of PEOPLE)if(!w.members.some(m=>m.email===p.email))w.members.push(p);w.invitations=w.invitations.filter(i=>!PEOPLE.some(p=>p.email===i.email))});expertSave(w=>{for(const p of PEOPLE)if(!w.members.some(m=>m.email===p.email))w.members.push(p)});remember({step:2,acceptedAt:new Date().toISOString()});break}
 case 2:{const name=agentName.trim()||AGENT;expertSave(w=>{if(!w.agents.some(a=>a.id==='upgrade-researcher'))w.agents.push({id:'upgrade-researcher',name,description:'研究 Work 升级场景与方案，整理依据、实施范围和验收清单。',runtime:'云端工作区',model:'默认模型',harness:'Codex',status:'在线',owner:'肖叶茂',access:'整个工作区',color:'violet',skills:['需求分析','数据分析'],instructions:'先确认升级目标，基于当前工作区资料研究统一会话、任务协作、进展卡片和主动提醒。输出场景对照、范围建议与验收清单，明确依据；不声称已进行外部联网调研。',runs:0})});updateWorkspace(w=>{if(!w.agents.some(a=>a.name===name))w.agents.push({name,description:'Work 升级研究与验收清单',runtime:'云端工作区',visibility:'工作区',instructions:'研究 Work 升级场景、实施范围与验收标准',model:'默认',online:true,runs:0,emoji:'🔎',skills:['需求分析','数据分析']})});remember({step:3,agent:name});go(teamUrl('agents.html?id=upgrade-researcher'));break}
 case 3:{setIdentity('肖叶茂');const c=newConversation({title:'Work 升级：初步想法',project:PROJECT});remember({step:4,initial:c.id});sendConversationMessage(c.id,'我想安排 Work 软件升级调研和 Demo 搭建。先帮我梳理该升级哪些协作场景、需要哪些交付物，以及要和同事确认什么。',[],getWorkspace());go(conversationUrl(c.id));break}
 case 4:{setIdentity('肖叶茂');const c=newConversation({title:'Work 升级：目标与分工确认',project:PROJECT});c.members=['肖叶茂','杨陈皓','林知夏','林悦',ownWork('肖叶茂'),s.agent||AGENT];saveConversation(c);message(c.id,'系统','肖叶茂邀请杨陈皓、林知夏、林悦和'+(s.agent||AGENT)+'加入会话','system');sendConversationMessage(c.id,'这次先完成 Work 升级调研与可交互 Demo。@杨陈皓 请确认重点场景，@林知夏 看一下实现边界，@林悦 帮我们确认验收要求。',[],getWorkspace());setIdentity('杨陈皓');sendConversationMessage(c.id,'建议优先覆盖统一会话、任务协作、领导查询进展和主动提醒。调研输出场景对照与取舍依据，不扩大到完整生产服务。',[],getWorkspace());setIdentity('林知夏');sendConversationMessage(c.id,'我负责交互 Demo，先让主流程在前端闭环。旧版登录态需要单列兼容验证，避免升级时丢失上下文。',[],getWorkspace());setIdentity('林悦');sendConversationMessage(c.id,'同意这个范围。验收就沿着“邀请→讨论→任务→查询→风险跟进”走一遍，任务要有负责人，成果和依据能回到原文。',[],getWorkspace());setIdentity('肖叶茂');remember({step:5,group:c.id});go(conversationUrl(c.id));break}
 case 5:{const p=proposalIssues(s);if(p.length){if(p.some(p=>!p.issueId))throw new Error('先在下方任务卡片点击「创建全部任务」，再进入任务协作。');remember({step:6,issues:Object.fromEntries(p.map(p=>[p.id,p.issueId]))});go(teamUrl('work.html?issue='+p.find(p=>p.id==='upgrade-build')!.issueId));break}appendConversationMessage(s.group,{id:'upgrade-task-plan',author:s.agent||AGENT,text:'目标已经确认。我按调研、范围、Demo 和兼容验证整理了四项任务草稿，负责人沿用刚才的分工。创建后就能在任务里继续协作。',time:clock(),proposals:proposalSpecs()});remember({planReady:true});go(conversationUrl(s.group));break}
 case 6:{const ids=s.issues;patchIssue(ids['upgrade-research'],{status:'已完成'});patchIssue(ids['upgrade-scope'],{status:'已完成'});patchIssue(ids['upgrade-build'],{status:'进行中'});patchIssue(ids['upgrade-compat'],{status:'进行中'});setIdentity('杨陈皓');taskComment(ids['upgrade-build'],'杨陈皓','调研结论：本轮升级聚焦统一会话、任务协作、进展卡片和主动提醒。范围与验收清单已确认，先把这四条链路做完整。');setIdentity('林知夏');taskComment(ids['upgrade-build'],'林知夏','Demo 主流程已搭起，接下来联调渐进卡片与主动提醒。@'+(s.agent||AGENT)+' 请根据当前任务整理一份验收清单。');setIdentity('肖叶茂');taskComment(ids['upgrade-build'],'肖叶茂','按这份清单逐项验证。兼容验证先保持进行中，有问题直接在对应任务里同步，我们一起跟进。');remember({step:7});go(teamUrl('work.html?issue='+ids['upgrade-build']));break}
 case 7:{const c=queryProgress(s,'帮我看看「Work 软件升级」现在进展怎么样');remember({step:8});go(conversationUrl(c.id));break}
 case 8:{setIdentity('肖叶茂');const id=s.issues['upgrade-compat'];patchIssue(id,{status:'阻塞',priority:'高'});taskComment(id,'林知夏','兼容验证发现：旧版登录态进入升级后的会话时，可能无法恢复原上下文。需要先确认迁移映射与回退方案，再完成兼容验收。');remember({step:9,riskAt:new Date().toISOString()});go(teamUrl('work.html?issue='+s.issues['upgrade-build']));break}
 case 9:{const viewed=findRiskConversation();if(!viewed)throw new Error('等右下角自动提醒出现，点击「一起看一下」查看风险后，再安排跟进。');taskComment(s.issues['upgrade-compat'],'肖叶茂','已看到 Work 的提醒。@林知夏 先按账号与原会话 ID 建立迁移映射，保留回退入口；@杨陈皓 补充登录态切换的验收用例。');remember({step:10,riskConversation:viewed.id});go(teamUrl('work.html?issue='+s.issues['upgrade-compat']));break}
 case 10:{taskComment(s.issues['upgrade-compat'],'林知夏','兼容方案已补齐：按原会话 ID 恢复上下文；迁移失败时返回旧入口，不丢失当前记录。Demo 中已覆盖成功与回退两条路径。');taskComment(s.issues['upgrade-compat'],'杨陈皓','已按兼容清单验证，原会话、任务关联和草稿均可恢复，本轮阻塞解除。');patchIssue(s.issues['upgrade-compat'],{status:'已完成'});patchIssue(s.issues['upgrade-build'],{status:'已完成'});const c=queryProgress(s,'再帮我看看「Work 软件升级」现在的进展和完成情况');remember({step:11,completedAt:new Date().toISOString()});go(conversationUrl(c.id));break}
 case 11:go(teamUrl('work.html?project='+encodeURIComponent(PROJECT)));break;
 }
}
function findRiskConversation(){return getConversations().find(c=>c.messages.some(m=>m.author==='肖叶茂'&&m.text.includes(PROJECT)&&/卡住|风险/.test(m.text)))}

export function UpgradeWalkthrough(){
 const team=useTeam(),who=useIdentity(),data=useWorkspace(),conversations=useConversations();
 const [state,setState]=useState(read),[open,setOpen]=useState(()=>sessionStorage.getItem('mw-upgrade-guide-open')!=='0'),[error,setError]=useState(''),[agent,setAgent]=useState(AGENT);
 useEffect(()=>{const refresh=()=>setState(read());refresh();window.addEventListener('mw-upgrade-step',refresh);return()=>window.removeEventListener('mw-upgrade-step',refresh)},[team.id]);
 if(!team.id.startsWith('upgrade-demo-')||!state)return null;
 const step=state.step||0,stage=STAGES[step];
 const act=async()=>{try{setError('');await advance(read(),agent)}catch(e){setError(e instanceof Error?e.message:'暂时没有完成，再试一次吧。')}};
 return <div className={'uw-guide '+(open?'is-open':'')}><button className="uw-trigger" aria-label="展开演示路线" aria-expanded={open} onClick={()=>{sessionStorage.setItem('mw-upgrade-guide-open',open?'0':'1');setOpen(!open)}}><span><Play size={13}/>升级演示</span><strong>{step===11?'已完成':(step+1)+'/11'} · {stage[0]}</strong><ChevronDown size={13}/></button>{open&&<section aria-label="Work 升级演示路线"><header><span>本地角色演示 · {who}</span><button aria-label="收起演示路线" onClick={()=>{sessionStorage.setItem('mw-upgrade-guide-open','0');setOpen(false)}}><X size={15}/></button></header><div className="uw-progress">{STAGES.slice(0,11).map((s,i)=><i key={i} title={s[0]} className={i<step?'done':i===step?'current':''}/>)}</div><h3>{stage[0]}</h3><p>{stage[1]}</p>{step===2&&<label>智能体名称<input aria-label="演示智能体名称" value={agent} onChange={e=>setAgent(e.target.value)}/><small>能力：需求分析、数据分析<br/>交付：场景对照、升级建议、验收清单</small></label>}{step===0&&<div className="uw-people">{PEOPLE.map(p=><span key={p.id}><Users size={12}/>{p.name}<small>{p.role}</small></span>)}</div>}{step===5&&state.planReady&&<small>已创建 {proposalIssues(state).filter(p=>p.issueId).length}/4 项任务</small>}{step===9&&<small>输入时会暂缓提醒，停留约 20–30 秒即可观察。若之前已有提醒，可从右下角展开。</small>}{error&&<p className="uw-error" role="alert">{error}</p>}<button className="uw-primary" onClick={act}>{step===5&&state.planReady?'任务已创建，进入协作':stage[2]}<ChevronRight size={14}/></button><nav>{state.initial&&<a href={conversationUrl(state.initial)}>初步讨论</a>}{state.group&&<a href={conversationUrl(state.group)}>目标与分工</a>}{state.leader&&<a href={conversationUrl(state.leader)}>领导查询</a>}<a href={teamUrl('work.html?project='+encodeURIComponent(PROJECT))}>项目任务</a></nav>{step===11&&<footer><Check size={14}/>全流程记录已保存<a href="work-upgrade-demo.html">再演示一轮<ArrowUpRight size={12}/></a></footer>}</section>}</div>;
}
