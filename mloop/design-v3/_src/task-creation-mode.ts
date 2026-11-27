import {Bot} from 'lucide-react';
import {collaborationDirectory} from './member-policy';
import {plainText} from './multica-ui/board-model';
import type {IssueCreationRequest,Workspace} from './multica-ui/store';

export type TaskCreationMode='manual'|'agent';
const modeKey='mw-task-create-mode-v1';
export function preferredTaskMode():TaskCreationMode{try{return localStorage.getItem(modeKey)==='agent'?'agent':'manual'}catch{return 'manual'}}
export function rememberTaskMode(mode:TaskCreationMode){try{localStorage.setItem(modeKey,mode)}catch{}}
export function taskCreationActors(workspace:Workspace,_who:string){
 const {agents,squads}=collaborationDirectory(workspace);
 return [...new Map(agents.map(a=>[a.name,a])).values()].map(a=>({value:'agent:'+a.name,label:a.name,description:a.runtime,group:'智能体',icon:Bot})).concat(squads.map(s=>({value:'squad:'+s.name,label:s.name,description:s.leader?'队长 '+s.leader:undefined,group:'小队',icon:Bot})));
}

export function prepareAgentTaskDraft({actor,prompt,project ,createdBy,attachments=[]}:{
 actor:{value:string;label:string};prompt:string;project:string;createdBy:string;attachments?:IssueCreationRequest['attachments'];
}){
 const description=prompt.trim(),createdAt=new Date().toISOString();
 const title=description.split('\n').map(plainText).find(Boolean)?.slice(0,40)||'新任务';
 const request:IssueCreationRequest={id:crypto.randomUUID(),createdAt,actorType:actor.value.startsWith('squad:')?'squad':'agent',actorName:actor.label,prompt:description,project,status:'已保存 · 本地演示',attachments:attachments.map(({name,size,type})=>({name,size,type}))};
 // Only pass planning context. The store supplies neutral task defaults for this demo.
 return {request,values:{title,description,project,createdBy,createdAt,updatedAt:createdAt}};
}
