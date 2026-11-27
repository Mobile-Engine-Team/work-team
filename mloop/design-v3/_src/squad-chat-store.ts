import {teamKey,currentTeam} from './team-context';
import {useSyncExternalStore} from 'react';
import {readExpertWorkspace} from './agent-workspace';

const KEY=()=>teamKey('mw-squad-chats-v1');
let cachedTeam='';
let rawCache:string|null|undefined,cached:string[]=[];
export const squadChatUrl=(id:string)=>'group-chat.html?'+new URLSearchParams({squad:id,team:currentTeam().id});
export function readSquadChatIds():string[]{
 if(cachedTeam!==currentTeam().id){rawCache=undefined;cachedTeam=currentTeam().id;}
 let raw=null;try{raw=localStorage.getItem(KEY())}catch{}
 if(raw===rawCache)return cached;
 rawCache=raw;try{const ids=JSON.parse(raw||(currentTeam().id==='brand'?'["content"]':'[]'));cached=Array.isArray(ids)?[...new Set(ids.filter(id=>typeof id==='string'))] as string[]:[]}catch{cached=[]}
 return cached;
}
export function activateSquadChat(id:string){
 const ids=readSquadChatIds();if(ids.includes(id))return;
 try{localStorage.setItem(KEY(),JSON.stringify([...ids,id]));rawCache=undefined;window.dispatchEvent(new Event('mw-squad-chats-change'))}catch{}
}
function subscribe(fn:()=>void){
 const storage=(e:StorageEvent)=>{if(e.key===KEY()||e.key===teamKey('mw-expert-agents-v1')||e.key===null)fn()};
 window.addEventListener('mw-team-change',fn);window.addEventListener('mw-squad-chats-change',fn);window.addEventListener('storage',storage);
 return()=>{window.removeEventListener('mw-team-change',fn);window.removeEventListener('mw-squad-chats-change',fn);window.removeEventListener('storage',storage)};
}
export function useSquadChatIds(){return useSyncExternalStore(subscribe,readSquadChatIds,readSquadChatIds)}
export function squadChatSource(id:string){
 const workspace=readExpertWorkspace();const squad=workspace.squads.find(s=>s.id===id&&!s.archived);
 if(!squad)return null;
 const members=squad.members.map(m=>{const entity=(m.type==='agent'?workspace.agents:workspace.members).find(a=>a.id===m.id);return {...m,entity}}).filter(m=>m.entity);
 const directory=[...workspace.agents.map(a=>({id:a.id,name:a.name,role:'智能体',color:a.color||'blue',job:a.description||'智能体',online:a.status==='在线',bot:true,avatar:a.avatar})),...workspace.members.map(m=>({id:m.id,name:m.name,role:'成员',color:'blue',job:'工作区成员',online:true}))];
 return {squad,members,leader:workspace.agents.find(a=>a.id===squad.leader),directory};
}
