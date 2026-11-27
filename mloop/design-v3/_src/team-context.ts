import {useSyncExternalStore} from 'react';
import {identity} from './local-identity';

export type TeamInfo={id:string;name:string;initial:string;description:string;role:string;avatar?:string;color?:string;context?:string;created?:string;demo?:true;creator?:string};
const directoryKey='mw-team-directory-v1';
const defaults:TeamInfo[]=[
  {id:'product',name:'产品研发团队',initial:'研',description:'产品设计与研发协作',role:'所有者',color:'blue'},
  {id:'brand',name:'品牌运营团队',initial:'营',description:'内容策划与品牌运营',role:'成员',color:'violet'},
];
function readTeams():TeamInfo[]{try{const saved=JSON.parse(localStorage.getItem(directoryKey)||'null');if(Array.isArray(saved)&&saved.length&&saved.every(t=>typeof t.id==='string'&&typeof t.name==='string'))return saved}catch{}return defaults}
export let teams:TeamInfo[]=readTeams();
const subscribeDirectory=(fn:()=>void)=>{window.addEventListener('mw-team-directory-change',fn);return()=>window.removeEventListener('mw-team-directory-change',fn)};
export const useTeams=()=>useSyncExternalStore(subscribeDirectory,()=>teams);
function saveTeams(next:TeamInfo[]){localStorage.setItem(directoryKey,JSON.stringify(next));teams=next;window.dispatchEvent(new Event('mw-team-directory-change'))}
export function createTeam(values:Pick<TeamInfo,'name'|'description'|'avatar'|'color'|'demo'>,initialize?:(team:TeamInfo)=>void){
  const team:TeamInfo={...values,name:values.name.trim(),id:'team-'+crypto.randomUUID().slice(0,8),initial:values.name.trim().slice(0,1),role:'所有者',creator:identity(),context:'',created:new Date().toISOString()};
  initialize?.(team);
  teams=readTeams();saveTeams([...teams,team]);return team;
}
export function updateTeam(id:string,patch:Partial<TeamInfo>){saveTeams(teams.map(t=>t.id===id?{...t,...patch,id,initial:(patch.name||t.name).slice(0,1)}:t))}
const selectionKey='mw-active-team-v1';
const valid=(id:string|null)=>teams.some(t=>t.id===id);
function initialTeam(){
  const linked=new URLSearchParams(location.search).get('team');
  if(valid(linked)){try{sessionStorage.setItem(selectionKey,linked!)}catch{}return linked!}
  try{const id=sessionStorage.getItem(selectionKey)||localStorage.getItem(selectionKey);if(valid(id))return id!}catch{}
  return teams[0].id;
}
let activeId=initialTeam();
export const currentTeam=()=>teams.find(t=>t.id===activeId)||teams[0];
// The original team keeps every existing storage key, so prior prototype data survives.
export const teamKey=(base:string,teamId:string=activeId)=>teamId==='product'?base:base+'::team:'+teamId;
export function useTeam(){return useSyncExternalStore(fn=>{window.addEventListener('mw-team-change',fn);window.addEventListener('mw-team-directory-change',fn);return()=>{window.removeEventListener('mw-team-change',fn);window.removeEventListener('mw-team-directory-change',fn)}},currentTeam)}
export function isTeamPage(name:string){return ['index','space','agents','squads','work','group-chat','settings-runtimes'].includes(name)||name.startsWith('automation')}
export function switchTeam(id:string){
  if(!valid(id)||activeId===id)return;
  try{sessionStorage.setItem(selectionKey,id);localStorage.setItem(selectionKey,id)}catch{}
  const page=document.body.dataset.page||'index';
  if(isTeamPage(page)){
    const root=page.startsWith('automation')?'automation':page==='group-chat'&&!['product','brand'].includes(id)?'work':page;
    // Object IDs and filters belong to the previous team; enter the new module root.
    const params=new URLSearchParams({team:id});
    if(root==='group-chat'&&id==='brand')params.set('squad','content');
    location.href=root+'.html?'+params;
    return;
  }
  activeId=id;
  const url=new URL(location.href);url.searchParams.set('team',id);url.searchParams.delete('conversation');url.searchParams.delete('issue');history.replaceState(null,'',url);
  window.dispatchEvent(new Event('mw-team-change'));
}
// Team links carry their context when opened in a new tab or shared.
document.addEventListener('click',event=>{
  const anchor=(event.target as Element)?.closest?.('a[href]');
  if(!anchor)return;
  const url=new URL(anchor.getAttribute('href')!,location.href);
  const name=url.pathname.split('/').pop()?.replace(/\.html$/,'')||'';
  if(url.origin===location.origin&&url.pathname.endsWith('.html')){if(!valid(url.searchParams.get('team')))url.searchParams.set('team',activeId);anchor.setAttribute('href',url.href)}
},true);
window.addEventListener('storage',event=>{if(event.key===directoryKey){teams=readTeams();window.dispatchEvent(new Event('mw-team-directory-change'))}});

export function teamUrl(path:string){const url=new URL(path,location.href);url.searchParams.set('team',activeId);return url.pathname.split('/').pop()+url.search+url.hash}
// Context-menu "Open link in new tab" doesn't fire click; keep hrefs canonical too.
let linkRewriteQueued=false;
const rewriteTeamLinks=()=>{if(linkRewriteQueued)return;linkRewriteQueued=true;queueMicrotask(()=>{linkRewriteQueued=false;document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(anchor=>{const href=anchor.getAttribute('href');if(!href||href.startsWith('#')||anchor.hasAttribute('download'))return;try{const url=new URL(href,location.href);if(url.origin!==location.origin||!url.pathname.endsWith('.html'))return;if(!valid(url.searchParams.get('team')))url.searchParams.set('team',activeId);const next=url.pathname.split('/').pop()+url.search+url.hash;if(href!==next)anchor.setAttribute('href',next)}catch{}})})};
new MutationObserver(rewriteTeamLinks).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});
rewriteTeamLinks();
