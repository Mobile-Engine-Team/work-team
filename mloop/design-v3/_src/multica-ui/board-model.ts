import {teamKey} from '../team-context';
import {useSyncExternalStore} from 'react';
import {Issue} from './store';

export const boardStatuses=['待规划','待办','进行中','审核中','阻塞','已完成','已取消'];
export const statusColors:Record<string,string>={'待规划':'#929ba8','待办':'#73829b','进行中':'#e4a128','审核中':'#8b6bd5','阻塞':'#e2686b','已完成':'#35a780','已取消':'#a0a7b2'};
export type BoardIssue=Issue&{labels?:string[];createdAt?:string;updatedAt?:string;subscribers?:string[];activity?:{id:string;text:string;time:string}[];wakeups?:{id:string;time:string;prompt:string;enabled:boolean}[];links?:{id:string;title:string;url:string}[];runs?:{id:string;time:string;assignee:string;status:string}[]};
export type BoardSettings={layout:'board'|'list'|'table'|'swimlane';laneGroup:string;tableGroup:string;tableColumns:string[];group:string;sort:string;direction:string;hidden:string[];properties:string[];status:string[];priority:string[];assignee:string[];project:string[];due:string;labels:string[];query:string};
export const defaultSettings:BoardSettings={layout:'board',laneGroup:'assignee',tableGroup:'none',tableColumns:['status','priority','assignee','project','due'],group:'status',sort:'updated',direction:'desc',hidden:['已取消'],properties:['priority','assignee','due','project'],status:[],priority:[],assignee:[],project:[],due:'全部日期',labels:[],query:''};
type BoardState={orders?:Record<string,number[]>;settings:Record<string,BoardSettings>;saved:Record<string,BoardSettings>;navCollapsed:boolean;rail:boolean;expanded:string[]};
const key=()=>teamKey('mw-board-ui-v3');
function read():BoardState{try{return {settings:{},saved:{},navCollapsed:false,rail:false,expanded:[],...JSON.parse(localStorage.getItem(key())||'{}')}}catch{return {settings:{},saved:{},navCollapsed:false,rail:false,expanded:[]}}}
let state=read();const listeners=new Set<()=>void>();
export function updateBoard(fn:(draft:BoardState)=>void){const draft=structuredClone(state);fn(draft);localStorage.setItem(key(),JSON.stringify(draft));state=draft;listeners.forEach(fn=>fn())}
export function useBoard(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>state)}
window.addEventListener('storage',event=>{if(event.key===key()){state=read();listeners.forEach(fn=>fn())}});
export function getSettings(view:string,state:BoardState):BoardSettings{const settings={...defaultSettings,...state.saved[view],...state.settings[view]};return {...settings,laneGroup:settings.laneGroup==='project'?'project':'assignee',properties:settings.properties.filter(p=>p!=='children')}}
export function filterIssues(issues:BoardIssue[],s:BoardSettings){
  const today=new Date().toLocaleDateString('en-CA');
  return issues.filter(i=>(!s.status.length||s.status.includes(i.status))&&(!s.priority.length||s.priority.includes(i.priority))&&(!s.assignee.length||s.assignee.includes(i.assignee))&&(!s.project.length||s.project.includes(i.project||'无关联项目'))&&(!s.labels.length||s.labels.some(l=>i.labels?.includes(l)))&&(s.due==='全部日期'||s.due==='未设置'&&!i.due||s.due==='已逾期'&&i.due&&i.due<today&&i.status!=='已完成'||s.due==='今天到期'&&i.due===today||s.due==='未来七天'&&i.due&&i.due>=today&&new Date(i.due).getTime()<=Date.now()+7*86400000)&&(!s.query.trim()||('ANDR-'+i.id+' '+i.title+' '+i.description+' '+i.assignee).toLowerCase().includes(s.query.trim().toLowerCase())));
}
export function sortIssues(issues:BoardIssue[],s:BoardSettings){const priority=['紧急','高','中','低','无优先级'];return [...issues].sort((a,b)=>{
  if(a.pinned!==b.pinned)return a.pinned?-1:1;
  if(s.sort==='due'&&!!a.due!==!!b.due)return a.due?-1:1;
  let value=s.sort==='priority'?priority.indexOf(a.priority)-priority.indexOf(b.priority):s.sort==='status'?boardStatuses.indexOf(a.status)-boardStatuses.indexOf(b.status):s.sort==='assignee'?a.assignee.localeCompare(b.assignee,'zh-CN'):s.sort==='project'?a.project.localeCompare(b.project,'zh-CN'):s.sort==='start'?(a.start||'9999').localeCompare(b.start||'9999'):s.sort==='title'?a.title.localeCompare(b.title,'zh-CN'):s.sort==='due'?(a.due||'9999').localeCompare(b.due||'9999'):s.sort==='updated'?(a.updatedAt||a.createdAt||String(a.id).padStart(15,'0')).localeCompare(b.updatedAt||b.createdAt||String(b.id).padStart(15,'0')):a.id-b.id;
  return s.direction==='desc'?-value:value;
})}
export function filterCount(s:BoardSettings){return [s.status,s.priority,s.assignee,s.project,s.labels].filter(x=>x.length).length+(s.due!=='全部日期'?1:0)}
export function plainText(text=''){return text.replace(/[#*_`>\[\]]/g,'').replace(/\n+/g,' ').trim()}
export function patchBoardIssue(id:number,patch:Partial<BoardIssue>,update:any){update((s:any)=>{const i=s.issues.find((x:any)=>x.id===id);if(i)Object.assign(i,patch,{updatedAt:new Date().toISOString()})})}

window.addEventListener('mw-team-change',()=>{state=read();listeners.forEach(fn=>fn())});
