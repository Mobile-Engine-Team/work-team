import {BUILTIN_WORK} from './builtin-work';
import {readExpertWorkspace} from './agent-workspace';
import {directory,identity} from './local-identity';
export const ownWork=(who=identity())=>who+'的 Work 助手';
export const isWork=(name:string)=>/的\s*Work\s*助手$/i.test(name);
export const collaborationDirectory=(data:any)=>{const expert=readExpertWorkspace();return {members:[...(data.members||[]),...expert.members],agents:[...(data.agents||[]),...expert.agents].filter(a=>!a.archived),squads:[...(data.squads||[]),...expert.squads].filter(s=>!s.archived)}};
export const isSquad=(name:string,data:any)=>collaborationDirectory(data).squads.some(s=>s.name===name);
export const isAgent=(name:string,data:any)=>isWork(name)||collaborationDirectory(data).agents.some(a=>a.name===name)||isSquad(name,data);
export function squadParticipants(name:string,data:any){const expert=readExpertWorkspace(),s=collaborationDirectory(data).squads.find(s=>s.name===name);return (s?.members||[]).map(m=>typeof m==='string'?m:m.type==='agent'?expert.agents.find(a=>a.id===m.id&&!a.archived)?.name:expert.members.find(p=>p.id===m.id)?.name).filter(Boolean).map(n=>n===BUILTIN_WORK.name?ownWork():n)}
export function people(data:any){return [...new Set([...directory(),...collaborationDirectory(data).members.map((m:any)=>m.name),identity()])].filter(n=>n!=='xym'&&!isAgent(n,data))}
export function mentionCandidates(members:string[],data:any,who=identity()){
 // Humans can be invited by mention. An assistant can only be summoned by its owner.
 return [...new Set([...members,...people(data),ownWork(who),...collaborationDirectory(data).agents.filter((a:any)=>!a.builtin&&!isWork(a.name)).map((a:any)=>a.name),...collaborationDirectory(data).squads.map(s=>s.name)])];
}
export function canInvite(name:string,members:string[],data:any,who=identity()){
 return members.includes(name)||name===ownWork(who)||(!isWork(name)&&mentionCandidates([],data,who).includes(name));
}
export function parseMentions(text:string,names:string[]){
 const found:string[]=[];const sorted=[...names].sort((a,b)=>b.length-a.length);
 for(let at=text.indexOf('@');at!==-1;){const tail=text.slice(at+1);const name=sorted.find(n=>tail.startsWith(n)&&(!tail[n.length]||/[\s@，。！？,:：!；;、]/.test(tail[n.length])));if(name)found.push(name);at=text.indexOf('@',at+1+(name?.length||0))}
 return [...new Set(found)];
}
export function blockedWorkMentions(text:string,members:string[],who=identity()){
 const works=[...text.matchAll(/@([^@\n，。！？,:：!；;]+?的\s*Work\s*助手)/gi)].map(m=>m[1].trim());
 return works.filter(n=>n!==ownWork(who)&&!members.includes(n));
}
