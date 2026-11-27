import {useSyncExternalStore} from 'react';
const key='mw-local-identity';
export const DEFAULT_LOCAL_IDENTITY='肖叶茂';
export const identity=()=>sessionStorage.getItem(key)||DEFAULT_LOCAL_IDENTITY;
export function setIdentity(name:string){if(!name.trim())return;sessionStorage.setItem(key,name.trim());localStorage.setItem('mw-local-person:'+encodeURIComponent(name.trim()),name.trim());window.dispatchEvent(new Event('mw-identity'));}
export function directory():string[]{try{return [...new Set([...JSON.parse(localStorage.getItem('mw-local-people')||'[]'),...Object.keys(localStorage).filter(k=>k.startsWith('mw-local-person:')).map(k=>localStorage.getItem(k))])].filter(Boolean).sort()}catch{return []}}
export function useIdentity(){return useSyncExternalStore(fn=>{window.addEventListener('mw-identity',fn);return()=>window.removeEventListener('mw-identity',fn)},identity)}
export const openSettings=(conversation?:string)=>window.dispatchEvent(new CustomEvent('mw-open-settings',{detail:{conversation}}));

export function useDirectory(){return JSON.parse(useSyncExternalStore(fn=>{const storage=(e:StorageEvent)=>{if(e.key?.startsWith('mw-local-person:')||e.key==='mw-local-people')fn()};window.addEventListener('storage',storage);window.addEventListener('mw-identity',fn);return()=>{window.removeEventListener('storage',storage);window.removeEventListener('mw-identity',fn)}},()=>JSON.stringify(directory())))}
