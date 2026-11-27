// Integrate the native workspace with the distributed legacy shell bundle.
// The original full build depends on a source checkout from another machine.
// Source integration also lives in main.tsx/chrome.tsx for future full builds.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const bundle=new URL('assets/build/design.js',root);
let code=readFileSync(bundle,'utf8');
const replacements=[
 ['function Sz({children:e}){var K;const t=document.body.dataset.page||"index",s=gi().issues.filter(F=>!F.parent&&!F.archived),[i,o]=x.useState(!1)', 'function Sz({children:e}){var K;const t=document.body.dataset.page||"index",s=gi().issues.filter(F=>!F.parent&&!F.archived),[i,o]=x.useState(()=>(["agents","squads"].includes(t)||t.startsWith("automation"))&&window.innerWidth<=760)'],
 ['{key:"connectors",label:"工具",iconSrc:`${ry}tool.svg`,fallbackIcon:ZT}];','{key:"connectors",label:"工具",iconSrc:`${ry}tool.svg`,fallbackIcon:ZT},{key:"agents",label:"智能体",iconSrc:`${ry}agent.svg`,fallbackIcon:ZT}];'],
 ['"tools","my-tools"].includes(t)','"tools","my-tools","agents","squads"].includes(t)'],
 ['let n=$9(Nn)?a.jsx(VK,{page:Nn}):','let n=["agents","squads"].includes(Nn)?a.jsx("agent-workspace",{}):$9(Nn)?a.jsx(VK,{page:Nn}):']
];
for(const [before,after] of replacements){
 if(code.includes(after))continue;
 if(code.split(before).length!==2)throw new Error('Shell changed; rebuild from main.tsx instead of patching an unknown bundle.');
 code=code.replace(before,after);
}
writeFileSync(bundle,code);
const hash=path=>createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex').slice(0,10);
for(const file of readdirSync(root).filter(f=>f.endsWith('.html'))){
 const path=new URL(file,root);let html=readFileSync(path,'utf8');
 for(const asset of ['assets/build/design.js','_src/agent-workspace.js','_src/agent-workspace.css']){
  html=html.replace(new RegExp(asset.replaceAll('.','\\.')+'(?:\\?v=[^" ]+)?','g'),asset+'?v='+hash(asset));
 }
 writeFileSync(path,html);
}
console.log('Agent workspace integrated; HTML asset versions updated.');
