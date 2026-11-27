import {BUILTIN_WORK} from './builtin-work.ts';
// This module is shared by rendering and the message boundary: hidden controls
// cannot leak a previous recipient's configuration into another request.
export type ComposerConfig={permission?:string;workspace?:string};
export type ComposerAgent={id?:string;name:string;model?:string;runtime?:string;archived?:boolean};
export type ComposerDirectory={agents:ComposerAgent[];squads:{name:string;leader?:string}[]};
export const workName=(who:string)=>who+'的 Work 助手';
export const isWorkRecipient=(name:string)=>/的\s*Work\s*助手$/i.test(name);
export function composerMentions(text:string,names:string[],who:string){
 const result:string[]=[];
 const sorted=[...new Set(names)].sort((a,b)=>b.length-a.length);
 for(let index=text.indexOf('@');index>=0;){const tail=text.slice(index+1);const name=sorted.find(n=>tail.startsWith(n)&&(!tail[n.length]||/[\s@，。！？,:：!；;、]/.test(tail[n.length])));if(name)result.push(name);else if(/^work(?=$|[\s@，。！？,:：!；;、])/i.test(tail))result.push(workName(who));index=text.indexOf('@',index+1+(name?.length||0))}
 return [...new Set(result)];
}
export function recipientProfile(name:string,directory:ComposerDirectory,workspace:any){
 const isWork=isWorkRecipient(name),squad=directory.squads.find(s=>s.name===name);
 const agent=directory.agents.find(a=>a.name===name||isWork&&a.id==='builtin-work')||(squad?.leader?directory.agents.find(a=>a.id===squad.leader||a.name===squad.leader):undefined);
 return {name,isWork,agent,squad,model:agent?.model||(isWork?BUILTIN_WORK.model:'跟随智能体'),runtime:agent?.runtime||(isWork?BUILTIN_WORK.runtime:'跟随智能体')};
}
export function composerContext({members,who,draft,candidates,directory,workspace}:any){
 const ai=(name:string)=>isWorkRecipient(name)||directory.agents.some((a:ComposerAgent)=>a.name===name)||directory.squads.some((s:any)=>s.name===name);
 const others=members.filter((n:string)=>n!==who);
 const kind: 'work'|'agent'|'group'=others.length===1&&ai(others[0])?(isWorkRecipient(others[0])?'work':'agent'):'group';
 const mentions=composerMentions(draft,candidates,who).filter(ai);
 const targets=kind==='group'?mentions:[others[0]||workName(who)];
 return {kind,mentions,targets,profiles:targets.map((name:string)=>recipientProfile(name,directory,workspace))};
}
export function allowedComposerConfig(profile:ReturnType<typeof recipientProfile>,config:ComposerConfig,workspace:any):ComposerConfig{
 const result:ComposerConfig={};
 if(profile.isWork){result.permission=config.permission==='完全访问'?'完全访问':'默认权限';result.workspace=workspace.projects?.some((p:any)=>p.name===config.workspace)?config.workspace:''}
 return result;
}
export function composerRequest(context:ReturnType<typeof composerContext>,configs:Record<string,ComposerConfig>,workspace:any){
 return {kind:context.kind,targets:context.profiles.map(profile=>({name:profile.name,model:profile.model,runtime:profile.runtime,...allowedComposerConfig(profile,configs[profile.name]||{},workspace)}))};
}
