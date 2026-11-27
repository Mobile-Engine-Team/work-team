import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BUILTIN_WORK} from './builtin-work.ts';
import {composerContext,composerMentions,composerRequest} from './composer-capabilities.ts';

const who='小林',work=who+'的 Work 助手';
const directory={agents:[
 {id:'dev',name:'开发助手',model:'A',runtime:'本机'},
 {id:'writer',name:'内容助手',model:'B',runtime:'云端',chatOverrides:{model:true},chatModels:['C']},
],squads:[{name:'研发小队',leader:'dev'}]};
const workspace={projects:[{name:'客户端'}]};
const context=(members,draft='',agents=directory)=>composerContext({members,who,draft,candidates:[who,'同事',work,...agents.agents.map(a=>a.name)],directory:agents,workspace});
const request=(members,configs={},draft='',agents=directory)=>composerRequest(context(members,draft,agents),configs,workspace);

test('Work uses its preset model and runtime and validates conversation access separately',()=>{
 assert.deepEqual(request([who,work],{[work]:{model:'C',mode:'其他',workspace:'客户端',permission:'完全访问'}}),{
  kind:'work',targets:[{name:work,model:BUILTIN_WORK.model,runtime:BUILTIN_WORK.runtime,workspace:'客户端',permission:'完全访问'}],
 });
 const agents={...directory,agents:[...directory.agents,{...BUILTIN_WORK,model:'W'}]};
 assert.deepEqual(request([who,work],{[work]:{workspace:'另一个团队',permission:'无效值'}},'',agents).targets[0],{
  name:work,model:'W',runtime:BUILTIN_WORK.runtime,workspace:'',permission:'默认权限',
 });
});
test('direct agents ignore legacy overrides and Work-only options',()=>{
 assert.deepEqual(request([who,'内容助手'],{'内容助手':{model:'C',mode:'旧模式',workspace:'客户端',permission:'完全访问',skill:'写作',tool:'文档'}}),{
  kind:'agent',targets:[{name:'内容助手',model:'B',runtime:'云端'}],
 });
});
test('squads use the leader preset',()=>{
 assert.deepEqual(request([who,'研发小队']).targets,[{name:'研发小队',model:'A',runtime:'本机'}]);
});
test('human messages that do not mention AI carry no AI options',()=>{
 assert.deepEqual(request([who,'同事',work],{[work]:{model:'C'}},'请明天评审'),{kind:'group',targets:[]});
 assert.equal(context([who,'同事']).kind,'group');
 assert.equal(context([who,'开发助手','内容助手']).kind,'group');
});
test('Work alias and punctuation respect mention boundaries',()=>{
 assert.deepEqual(composerMentions('@Work，@内容助手 帮忙',[work,'内容助手'],who),[work,'内容助手']);
 assert.deepEqual(composerMentions('@Workstation @内容助手扩展',[work,'内容助手'],who),[]);
});
test('multiple mentions use separate presets and dropping a mention drops its options',()=>{
 const configs={[work]:{model:'A',permission:'完全访问'},'内容助手':{model:'C',skill:'写作'}};
 const members=[who,'同事',work];
 assert.deepEqual(request(members,configs,'@Work @内容助手 整理').targets,[
  {name:work,model:BUILTIN_WORK.model,runtime:BUILTIN_WORK.runtime,workspace:'',permission:'完全访问'},
  {name:'内容助手',model:'B',runtime:'云端'},
 ]);
 assert.deepEqual(request(members,configs,'@Work 整理').targets.map(t=>t.name),[work]);
});
