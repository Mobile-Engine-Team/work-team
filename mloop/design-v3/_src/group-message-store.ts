import {useEffect,useState} from 'react';
import {readJournal,writeJournal} from './local-journal';
import {teamKey} from './team-context';

export function groupMessageKeys():string[]{try{return JSON.parse(localStorage.getItem(teamKey('mw-demo-groups-v1'))||'[]')}catch{return []}}
export function readGroupMessages(key:string):any[]{return readJournal(key,()=>JSON.parse(localStorage.getItem(key+':base')||'[]'))}
export function mutateGroupMessages(key:string,fn:(messages:any[])=>void){const before=readGroupMessages(key),next=structuredClone(before);fn(next);writeJournal(key,before,next)}
export function useGroupMessages(key:string,initial:()=>any[]){
 const [messages,setState]=useState(()=>{if(!localStorage.getItem(key+':base'))localStorage.setItem(key+':base',JSON.stringify(initial()));const keys=groupMessageKeys();if(!keys.includes(key))localStorage.setItem(teamKey('mw-demo-groups-v1'),JSON.stringify([...keys,key]));return readGroupMessages(key)});
 useEffect(()=>{const update=()=>setState(readGroupMessages(key));const change=(e:any)=>{if(e.detail===key||e.key===null||e.key?.startsWith(key+':'))update()};window.addEventListener('storage',change);window.addEventListener('mw-local-change',change);return()=>{window.removeEventListener('storage',change);window.removeEventListener('mw-local-change',change)}},[key]);
 const setMessages=(value:any[]|((messages:any[])=>any[]))=>mutateGroupMessages(key,current=>{const next=typeof value==='function'?value(current):value;current.splice(0,current.length,...next)});
 return [messages,setMessages] as const;
}
