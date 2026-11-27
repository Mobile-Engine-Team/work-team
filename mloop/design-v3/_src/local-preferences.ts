import {useState} from 'react';
import {identity} from './local-identity';
const key=(name:string,personal=false)=>'mw-local-preference-v1:'+(personal?encodeURIComponent(identity())+':':'device:')+name;
export function readPreference<T>(name:string,fallback:T,personal=false):T{try{const raw=localStorage.getItem(key(name,personal));return raw?JSON.parse(raw):fallback}catch{return fallback}}
export function usePreference<T>(name:string,fallback:T,personal=false){
 const [value,setValue]=useState<T>(()=>readPreference(name,fallback,personal));
 const save=(next:T)=>{try{localStorage.setItem(key(name,personal),JSON.stringify(next));setValue(next);return true}catch{window.dispatchEvent(new CustomEvent('design-toast',{detail:'保存失败，请检查浏览器存储空间。'}));return false}};
 return [value,save] as const;
}
const media=matchMedia('(prefers-color-scheme: dark)');
export function applyTheme(theme:string){const dark=theme==='dark'||theme==='system'&&media.matches;document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.classList.toggle('dark',dark)}
export function applyFont(size:number){document.documentElement.style.setProperty('--mw-local-chat-font',size+'px')}
applyTheme(readPreference('theme','light'));
applyFont(readPreference('font',14));
media.addEventListener('change',()=>{if(readPreference<string>('theme','light')==='system')applyTheme('system')});
window.addEventListener('storage',event=>{if(event.key===key('theme'))applyTheme(readPreference('theme','light'));if(event.key===key('font'))applyFont(readPreference('font',14))});
