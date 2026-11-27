// Build the scheduled module against the distributed shell's shared components.
// Full source builds import these same components normally from scheduled-tasks.tsx.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const esbuild=require(process.env.ESBUILD_PATH||'esbuild');
const root=fileURLToPath(new URL('../',import.meta.url));
const shared={React:'C',createRoot:'SF.createRoot',AutomationDialog:'hF',TriggerDialog:'cF',Button:'kt',IconButton:'Et',Select:'lt',Menu:'Ts',MenuItem:'Tt',Modal:'Co',Confirm:'Dl',Avatar:'Yi',RichText:'yk',RichEditor:'io',getDefaultScheduleConfig:'R_',toCron:'k4',schedulePreview:'S4',scheduleDates:'x4',useWorkspace:'so',createIssue:'d4',issueUrl:'Tr'};
const groups={
 './multica':['AutomationDialog'],
 './multica-ui/automations':['TriggerDialog'],
 './multica-ui/primitives':['Button','IconButton','Select','Menu','MenuItem','Modal','Confirm','Avatar'],
 './multica-ui/rich-editor':['RichText','RichEditor'],
 './multica-ui/schedule':['getDefaultScheduleConfig','toCron','schedulePreview'],
 './multica-ui/schedule/preview':['scheduleDates'],
 './multica-ui/store':['useWorkspace','createIssue','issueUrl'],
 'react-dom/client':['createRoot'],
};
await esbuild.build({entryPoints:[root+'_src/scheduled-host.tsx'],bundle:true,outfile:root+'assets/build/scheduled.js',format:'iife',target:'es2022',jsx:'transform',plugins:[{name:'distributed-shared-components',setup(build){
 build.onResolve({filter:/.*/},args=>args.path==='react'||groups[args.path]?{path:args.path,namespace:'shared'}:null);
 build.onLoad({filter:/.*/,namespace:'shared'},args=>({contents:args.path==='react'?'const React=window.MLoopScheduledShared.React;export default React;export const {useState,useEffect,useRef,createElement,forwardRef}=React;':groups[args.path].map(name=>`export const ${name}=window.MLoopScheduledShared.${name};`).join('\n'),loader:'js'}));
}}]});
const bundle=root+'assets/build/design.js';let code=readFileSync(bundle,'utf8');
const before='Dn.startsWith("automation")?d.jsx(a$,{}):';const after='Dn.startsWith("automation")?d.jsx("scheduled-workspace",{}):';
if(!code.includes(after)){if(code.split(before).length!==2)throw Error('Unknown shell routing; use a full source build.');code=code.replace(before,after);}
const bridge='window.MLoopScheduledShared={'+Object.entries(shared).map(([key,value])=>key+':'+value).join(',')+'};';
const marker='SF.createRoot(document.getElementById("root")).render';
if(!code.includes(bridge)){if(code.split(marker).length!==2)throw Error('Unknown shell entry point.');code=code.replace(marker,bridge+marker);}
const begin=code.indexOf('function hF('),end=code.indexOf('function ',begin+20);
if(begin<0||end<0)throw Error('Shared AutomationDialog missing.');
let dialog=code.slice(begin,end);
if(!dialog.includes('scheduledEntityLabel')){
 dialog=dialog.replace('function hF({initial:e,editing:t,onClose:n,onSave:s})','function hF({initial:e,editing:t,onClose:n,onSave:s,entityLabel:scheduledEntityLabel="自动化"})');
 dialog=dialog.replaceAll('"请输入自动化名称"','("请输入"+scheduledEntityLabel+"名称")').replaceAll('"编辑自动化"','("编辑"+scheduledEntityLabel)').replaceAll('"新建自动化"','("新建"+scheduledEntityLabel)').replaceAll('"创建自动化"','("创建"+scheduledEntityLabel)').replaceAll('"自动化名称"','(scheduledEntityLabel+"名称")');
 code=code.slice(0,begin)+dialog+code.slice(end);
}
const oldMobile='["agents","squads"].includes(t)&&window.innerWidth<=760';
code=code.replace(oldMobile,'(["agents","squads"].includes(t)||t.startsWith("automation"))&&window.innerWidth<=760');
writeFileSync(bundle,code);
const hash=path=>createHash('sha256').update(readFileSync(root+path)).digest('hex').slice(0,10);
for(const file of readdirSync(root).filter(f=>f.endsWith('.html'))){
 let html=readFileSync(root+file,'utf8');
 if(['automation','automation-empty','automation-create','automation-runs'].some(name=>file===name+'.html')){
  if(!html.includes('assets/build/scheduled.css'))html=html.replace('</head>','<link rel="stylesheet" href="assets/build/scheduled.css"></head>');
  if(!html.includes('assets/build/scheduled.js'))html=html.replace('</body>','<script defer src="assets/build/scheduled.js"></script></body>');
 }
 for(const asset of ['assets/build/design.js','assets/build/scheduled.js','assets/build/scheduled.css'])html=html.replace(new RegExp(asset.replaceAll('.','\\.')+'(?:\\?v=[^" ]+)?','g'),asset+'?v='+hash(asset));
 writeFileSync(root+file,html);
}
console.log('Scheduled task module built and integrated.');
