import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const vite='/Users/xymtop/Desktop/mc/work/apps/app/node_modules/vite/bin/vite.js';
const result=spawnSync(process.execPath,[vite,'build','--config',root+'_src/vite.config.mjs'],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);
const css=root+'assets/build/style.css';
writeFileSync(css,readFileSync(css,'utf8').replaceAll('/mobilework/','../../mobilework/'));

for(const filename of readdirSync(root).filter(name=>name.endsWith('.html'))){
 let html=readFileSync(root+filename,'utf8');
 for(const asset of ['design.js','style.css']){
  const hash=createHash('sha256').update(readFileSync(root+'assets/build/'+asset)).digest('hex').slice(0,10);
  html=html.replace(new RegExp('assets/build/'+asset.replace('.','\\.')+'(?:\\?v=[^" ]+)?','g'),'assets/build/'+asset+'?v='+hash);
 }
 writeFileSync(root+filename,html);
}
