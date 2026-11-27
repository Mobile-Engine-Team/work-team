import {collaborationDirectory,mentionCandidates} from './member-policy';
import {composerContext,composerRequest,ComposerConfig} from './composer-capabilities';

export function readComposerContext(members:string[],who:string,draft:string,workspace:any){
 const source=collaborationDirectory(workspace);
 const directory={agents:[...new Map(source.agents.map(a=>[a.name,a])).values()],squads:[...new Map(source.squads.map(s=>[s.name,s])).values()]};
 return composerContext({members,who,draft,candidates:mentionCandidates(members,workspace,who),directory,workspace});
}
export function sanitizeComposerRequest(members:string[],who:string,text:string,workspace:any,request:any){
 const context=readComposerContext(members,who,text,workspace);
 const configs:Record<string,ComposerConfig>={};
 for(const profile of context.profiles)configs[profile.name]=request?.targets?.find((t:any)=>t.name===profile.name)||(!request?.targets&&context.kind==='work'?request||{}:{});
 return composerRequest(context,configs,workspace);
}
