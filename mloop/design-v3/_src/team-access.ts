import {identity,DEFAULT_LOCAL_IDENTITY} from './local-identity';
import {currentTeam,teamKey,type TeamInfo} from './team-context';
import type {Workspace} from './multica-ui/store';

type Member=Workspace['members'][number];
export function findLocalMember(members:Member[],who=identity()){
 return members.find(m=>m.email?.toLowerCase()===who.toLowerCase())??members.find(m=>m.name===who);
}
export function localTeamRole(team:TeamInfo,members:Member[],who=identity()){
 if(who===(team.creator??DEFAULT_LOCAL_IDENTITY)&&(team.role==='所有者'||team.id==='brand'))return team.role;
 return findLocalMember(members,who)?.role||'访客';
}
export const mayManageTeam=(role:string)=>role==='所有者'||role==='管理员';
export type InviteLink={id:string;role:string;created:string;expires:string;enabled:boolean};
export function readInviteLinks():InviteLink[]{try{const value=JSON.parse(localStorage.getItem(teamKey('mw-team-invite-links-v1'))||'[]');return Array.isArray(value)?value:[]}catch{return[]}}
export const inviteLinkAvailable=(link?:InviteLink)=>!!link?.enabled&&Date.parse(link.expires)>Date.now();
export const inviteURL=(id:string)=>location.origin+location.pathname.replace(/[^/]*$/,'')+'work.html?'+new URLSearchParams({team:currentTeam().id,invite:id});
