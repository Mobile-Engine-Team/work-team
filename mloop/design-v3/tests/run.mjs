// Runtime needs only Node; this developer-only suite additionally uses Playwright + Chromium.
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
const root=fileURLToPath(new URL('..',import.meta.url));
const cases=[['_src/composer-capabilities.test.mjs','--test'],['tests/local-acceptance.cjs'],['tests/project-regression.cjs'],['tests/project-status-regression.cjs'],['_src/verify-conversation-interactions.cjs'],['_src/verify-fresh-workspace.cjs'],['tests/lifecycle-acceptance.cjs']];
const require=createRequire(import.meta.url);
try{require.resolve('playwright')}catch{console.error('验收需要 Playwright。请将其安装在隔离工具目录并在环境变量 NODE_PATH 指向对应 node_modules。启动原型不需要安装。');process.exit(2)}
const existing=process.env.MLOOP_URL;
const port=process.env.MLOOP_TEST_PORT||'8096';
const base=existing||`http://127.0.0.1:${port}`;
const server=existing?null:spawn(process.execPath,['serve.mjs',port],{cwd:root,stdio:'inherit'});
try{
 if(server){const p=await Promise.race([once(server,'spawn'),once(server,'error').then(([error])=>{throw error})]);void p}
 let ready=false;
 for(let i=0;i<25&&!ready;i++){
  if(server&&server.exitCode!==null)break;
  try{const response=await fetch(base+'/index.html',{signal:AbortSignal.timeout(750)});ready=response.ok}catch{}
  if(!ready)await new Promise(r=>setTimeout(r,150));
 }
 if(!ready)throw new Error(`预览未启动：${base}`);
 const results=[];
 for(const [file,flag] of cases){
  console.log('\n=== '+file+' ===');
  const r=spawnSync(process.execPath,[...(flag?[flag]:[]),file],{cwd:root,env:{...process.env,MLOOP_URL:base},stdio:'inherit',timeout:180000});
  results.push([file,r.status===0]);if(r.error)console.error(r.error.message);
 }
 console.log('\n=== 验收汇总 ===');for(const [file,ok] of results)console.log(`${ok?'PASS':'FAIL'} ${file}`);
 if(results.some(([,ok])=>!ok))process.exitCode=1;
}catch(error){console.error(error.message);process.exitCode=1}finally{server?.kill()}
