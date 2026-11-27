import type {Conversation} from './collaboration-store';
import type {QuerySpec,QuerySurface} from './a2ui-query';

export const queryViewId=(spec:QuerySpec)=>'query:'+spec.kind+':'+spec.subject;
export const queryViewTitle=(spec:QuerySpec)=>spec.subject+(spec.kind==='risk'?' · 待关注':' · 进展看板');
export const queryViewSummary=(spec:QuerySpec)=>(spec.days?'近 '+spec.days+' 天':'全部记录')+(spec.status?' · '+spec.status:'');
export type ViewVersion={surface:QuerySurface;messageId:string;prompt:string;number:number};
export type ConversationView={id:string;title:string;versions:ViewVersion[]};

export function conversationViews(conversation:Conversation|undefined,who:string):ConversationView[]{
 const views=new Map<string,ConversationView>();let prompt='';
 for(const message of conversation?.messages||[]){
  if(message.visibleTo&&message.visibleTo!==who)continue;
  if(message.author===who&&message.text)prompt=message.text;
  for(const surface of [...(message.surfaceHistory||[]),...(message.surface?[message.surface]:[])]){
   const id=surface.viewId||queryViewId(surface.result.spec);
   const view=views.get(id)||{id,title:queryViewTitle(surface.result.spec),versions:[]};
   if(!view.versions.some(v=>v.surface.id===surface.id))view.versions.push({surface,messageId:message.id,prompt:surface.instruction||prompt,number:0});
   views.set(id,view);
  }
 }
 return [...views.values()].map(view=>{
  view.versions.sort((a,b)=>a.surface.startedAt-b.surface.startedAt);
  view.versions.forEach((version,index)=>version.number=index+1);
  view.title=queryViewTitle(view.versions.at(-1)!.surface.result.spec);
  return view;
 }).sort((a,b)=>a.versions.at(-1)!.surface.startedAt-b.versions.at(-1)!.surface.startedAt);
}
