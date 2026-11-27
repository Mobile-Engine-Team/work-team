import {teamKey} from './team-context';
import {identity} from './local-identity';
export type InviteEvent={id:string;to:string;from:string;time:string;context:string;href:string;acceptedAt?:string;conversation?:string;email?:string;role?:string};
export function invitationEvents():InviteEvent[]{return Object.keys(localStorage).filter(k=>k.startsWith(teamKey('mw-invitation-event-v1')+':')).flatMap(k=>{try{return [JSON.parse(localStorage.getItem(k)!)]}catch{return []}})}
export function writeInvitation(event:InviteEvent){localStorage.setItem(teamKey('mw-invitation-event-v1')+':'+event.id,JSON.stringify(event));window.dispatchEvent(new Event('mw-invitations'))}
export function matchesInvite(to:string,who=identity(),members:any[]=[]){return to.toLowerCase()===who.toLowerCase()||members.some(m=>m.name===who&&m.email?.toLowerCase()===to.toLowerCase())}
