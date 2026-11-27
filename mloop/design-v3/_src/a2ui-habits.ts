import {useSyncExternalStore} from 'react';
import {currentTeam} from './team-context';
import {identity} from './local-identity';
import type {Habit} from './a2ui-entry-model';
const prefix='mw-recommendation-habits-v1:';
const storageKey=()=>prefix+encodeURIComponent(currentTeam().id)+':'+encodeURIComponent(identity());
export function readHabits():Habit[]{try{const items=JSON.parse(localStorage.getItem(storageKey())||'[]');return Array.isArray(items)?items.filter(e=>e&&typeof e.key==='string'&&Number.isFinite(e.at)&&['query','open','visit'].includes(e.kind)):[]}catch{return []}}
export function recordHabit(key:string,kind:Habit['kind']='query'){
 try{const now=Date.now();let events=readHabits().filter(e=>now-e.at<30*86400000);const last=events.at(-1);if(last?.key===key&&last.kind===kind&&now-last.at<2000)return;events.push({key,kind,at:now});localStorage.setItem(storageKey(),JSON.stringify(events.slice(-200)));window.dispatchEvent(new Event('mw-recommendation-change'))}catch{/* Recommendations must never interrupt sending or navigation. */}
}
const snapshot=()=>JSON.stringify(readHabits());
export function useHabits(){return JSON.parse(useSyncExternalStore(fn=>{const sync=(e:StorageEvent)=>{if(e.key===null||e.key?.startsWith(prefix))fn()};window.addEventListener('storage',sync);for(const name of ['mw-recommendation-change','mw-identity','mw-team-change'])window.addEventListener(name,fn);return()=>{window.removeEventListener('storage',sync);for(const name of ['mw-recommendation-change','mw-identity','mw-team-change'])window.removeEventListener(name,fn)}},snapshot)) as Habit[]}
// Observe visits to real destinations, including entries opened from navigation.
const visits:Record<string,string>={'files.html':'files','settings-models.html':'models'};
const destination=visits[location.pathname.split('/').at(-1)||''];if(destination)recordHabit(destination,'visit');
