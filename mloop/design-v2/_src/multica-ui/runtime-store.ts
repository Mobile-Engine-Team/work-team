import {useSyncExternalStore} from 'react';

export type Runtime = {id:string; provider:string; name:string; visibility:string; members:string[]; concurrency:string; command?:string; description?:string};
export type Machine = {id:string; name:string; defaultName:string; owner:string; local:boolean; online:boolean; runtimes:Runtime[]};
type Qoder = {connected:boolean; enabled:boolean; region:string; environment:string; concurrency:number; timeout:number; repos:{url:string}[]};
type State = {autoStart:boolean; autoStop:boolean; daemonRunning:boolean; machines:Machine[]; qoder:Qoder};
const key='work-v2-runtime-settings-v1';
const runtime=(id:string,provider:string,name:string):Runtime=>({id,provider,name,visibility:'private',members:[],concurrency:''});
const initial:State={autoStart:true,autoStop:false,daemonRunning:true,machines:[
  {id:'local',name:'',defaultName:'xymtopdeMacBook-Air.local',owner:'你',local:true,online:true,runtimes:[runtime('claude','claude','Claude Code'),runtime('codex','codex','Codex'),runtime('cursor','cursor','Cursor')]},
  {id:'peng',name:'',defaultName:'pengdeMacBook-Air.local',owner:'peng1980321844',local:false,online:true,runtimes:[runtime('peng-codex','codex','Codex')]},
],qoder:{connected:false,enabled:true,region:'global',environment:'',concurrency:3,timeout:60,repos:[]}};
function read():State{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value?.machines&&value?.qoder?value:structuredClone(initial)}catch{return structuredClone(initial)}}
let state=read();const listeners=new Set<()=>void>();
export function useRuntimeState(){return useSyncExternalStore(cb=>{listeners.add(cb);return()=>listeners.delete(cb)},()=>state)}
export function updateRuntimeState(change:(draft:State)=>void){const next=structuredClone(state);change(next);state=next;try{localStorage.setItem(key,JSON.stringify(state))}catch{}listeners.forEach(fn=>fn())}
window.addEventListener('storage',e=>{if(e.key===key){state=read();listeners.forEach(fn=>fn())}});
export const machineName=(m:Machine)=>m.name||m.defaultName;
export function updateMachine(id:string,change:(m:Machine)=>void){updateRuntimeState(s=>{const m=s.machines.find(m=>m.id===id);if(m)change(m)})}
export function updateRuntime(mid:string,rid:string,change:(r:Runtime)=>void){updateMachine(mid,m=>{const r=m.runtimes.find(r=>r.id===rid);if(r)change(r)})}
export function removeRuntime(mid:string,rid:string){updateRuntimeState(s=>{const m=s.machines.find(m=>m.id===mid);if(!m)return;m.runtimes=m.runtimes.filter(r=>r.id!==rid);if(!m.local&&!m.runtimes.length)s.machines=s.machines.filter(m=>m.id!==mid)})}
