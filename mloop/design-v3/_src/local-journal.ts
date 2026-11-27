// Append-only, field-level changes keep independent writes from different pages.
// A page never replaces another page's workspace or message snapshot.
type Segment=string|{key:string;value:unknown};
type Change={path:Segment[];kind:'set'|'delete'|'add'|'remove';value?:any};
const same=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
const entityKey=(a:any[],b:any[])=>['id','name'].find(k=>[...a,...b].length&&[...a,...b].every(v=>v&&typeof v==='object'&&!Array.isArray(v)&&v[k]!==undefined));
function diff(a:any,b:any,path:Segment[]=[],out:Change[]=[]):Change[]{
 if(same(a,b))return out;
 if(Array.isArray(a)&&Array.isArray(b)){
  const key=entityKey(a,b);
  if(key){for(const old of a)if(!b.some(v=>same(v[key],old[key])))out.push({path:[...path,{key,value:old[key]}],kind:'delete'});for(const value of b){const old=a.find(v=>same(v[key],value[key]));if(old===undefined)out.push({path:[...path,{key,value:value[key]}],kind:'set',value});else diff(old,value,[...path,{key,value:value[key]}],out)}return out}
  if([...a,...b].every(v=>v===null||typeof v!=='object')){for(const value of a)if(!b.includes(value))out.push({path,kind:'remove',value});for(const value of b)if(!a.includes(value))out.push({path,kind:'add',value});return out}
 }
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){
  for(const key of new Set([...Object.keys(a),...Object.keys(b)])){if(!(key in b))out.push({path:[...path,key],kind:'delete'});else diff(a[key],b[key],[...path,key],out)}return out;
 }
 out.push({path,kind:'set',value:b});return out;
}
function apply(root:any,c:Change){
 let parent=root;
 for(let i=0;i<c.path.length-1;i++){const s=c.path[i];if(typeof s==='string'){if(parent[s]===undefined)parent[s]=typeof c.path[i+1]==='object'?[]:{};parent=parent[s]}else{let found=parent.find((v:any)=>same(v[s.key],s.value));if(!found)return;parent=found}}
 const last=c.path.at(-1);if(last===undefined)return;
 const key=typeof last==='string'?last:parent.findIndex((v:any)=>same(v[last.key],last.value));
 if(c.kind==='set'){if(typeof key==='number'&&key<0)parent.push(structuredClone(c.value));else parent[key]=structuredClone(c.value)}
 if(c.kind==='delete'){if(Array.isArray(parent)&&typeof key==='number'){if(key>=0)parent.splice(key,1)}else delete parent[key]}
 if((c.kind==='add'||c.kind==='remove')&&!Array.isArray(parent[key]))parent[key]=[];
 if(c.kind==='add'&&!parent[key].includes(c.value))parent[key].push(c.value);
 if(c.kind==='remove')parent[key]=parent[key].filter((v:any)=>!same(v,c.value));
}
export function readJournal<T>(key:string,base:()=>T):T{
 const state=structuredClone(base());
 for(const name of Object.keys(localStorage).filter(k=>k.startsWith(key+':change:')).sort()){try{for(const c of JSON.parse(localStorage.getItem(name)!))apply(state,c)}catch{}}
 return state;
}
let lastClock=0;
export function writeJournal<T>(key:string,before:T,after:T){
 const changes=diff(before,after);if(!changes.length)return;
 const clock=Math.max(Date.now(),lastClock+1,...Object.keys(localStorage).filter(k=>k.startsWith(key+':change:')).map(k=>Number(k.slice((key+':change:').length).split(':')[0])+1));lastClock=clock;
 localStorage.setItem(key+':change:'+String(clock).padStart(16,'0')+':'+crypto.randomUUID(),JSON.stringify(changes));
 window.dispatchEvent(new CustomEvent('mw-local-change',{detail:key}));
 try{const channel=new BroadcastChannel('mw-local-sync');channel.postMessage(key);channel.close()}catch{}
}
export function watchJournal(key:()=>string,refresh:()=>void){
 let queued=false;const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refresh()})};
 window.addEventListener('storage',e=>{if(e.key===null||e.key===key()||e.key?.startsWith(key()+':'))schedule()});
 window.addEventListener('mw-local-change',(e:Event)=>{if((e as CustomEvent).detail===key())schedule()});
 window.addEventListener('focus',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
 try{const channel=new BroadcastChannel('mw-local-sync');channel.onmessage=e=>{if(e.data===key())schedule()}}catch{}
}
