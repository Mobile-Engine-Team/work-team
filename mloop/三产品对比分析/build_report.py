from pathlib import Path
from collections import OrderedDict,Counter
import json,re,html,hashlib,subprocess,shutil,base64
from features_data import FEATURES
O=Path(__file__).resolve().parent
M=Path('/Users/xymtop/Desktop/multica');W=Path('/Users/xymtop/Desktop/mc/work');ROOT=O.parent
E=html.escape
PRODUCTS=['平凯 Loop','Multica','MobileWork']
VERS={'Multica':'3c5c8b245359b9b8e913a47f97211f2a3426f149','MobileWork':'8d2ea29fdf828de0d2e2fddec23130e6b71eb02e','平凯 Loop':'官方文档快照 2026-11-08'}
REG={}
loop={'members':'workspace-admin/manage-members-roles-and-invites','quickstart':'quickstart','workspace-admin':'workspace-admin','archive':'workspace-admin/archive-a-workspace','channels':'collaboration/channels-dms-threads-and-tasks','search':'collaboration/message-search','working':'collaboration/working-with-agents','teams':'agents/agent-teams','operate':'agents/operate-agents','roles-runtime':'agents/roles-agents-and-runtime','first-agent':'quickstart/create-your-first-agent','resources':'agents/configure-agent-resources','skills':'agents/use-agent-skills','memory':'agents/use-agent-memory','schedule':'collaboration/scheduled-follow-up-with-triggers','rewind':'collaboration/rewind-conversations','workflows':'workflows','share-answer':'collaboration/share-a-knowledge-qa-answer','external':'agents/external-app-call-agent','machines-auth':'machines/manage-loop-connections','machine-client':'machines/operate-loop-client','features':'features','pricing':'pricing'}
rawdocs=json.load(open(O/'资料快照/loop-official-docs.json'))['docs']
for k,slug in loop.items():
 p=O/'资料快照'/(slug.replace('/','__')+'.txt')
 url=next((d['url'] for d in rawdocs if d['url'].rstrip('/').endswith('/'+slug)), 'https://loop.pingkai.cn/'+(slug if slug in ['features','pricing'] else 'docs/'+slug))
 REG['L_'+k]={'path':p,'url':url,'product':PRODUCTS[0],'kind':'文档','label':next((l.strip() for l in p.read_text().splitlines() if l.strip() and l.strip()!='ZH'),slug),'line':1}
mdocs='workspaces auth-setup auth-tokens cloud-quickstart members-roles agents daemon-runtimes shortcuts issues chat comments channels inbox projects tasks assigning-issues mentioning-agents workflows project-resources vcs-integration squads agents-create skills providers autopilots issue-wakeups analytics security-model mobile-app desktop-app self-host-quickstart'.split()
for slug in mdocs:
 p=M/'apps/docs/content/docs'/f'{slug}.zh.mdx'
 if not p.exists():p=M/'apps/docs/content/docs'/f'{slug}.mdx'
 REG['M_'+slug]={'path':p,'url':'','product':'Multica','kind':'文档','label':slug,'line':1}
mcodes={'reaction-code':('server/internal/handler/reaction.go','func ('),'editor-code':('packages/views/editor/use-editor-upload.ts','export'),'attachment-code':('server/internal/handler/file_upload_limits.go','const ('),'plugin-code':('packages/views/settings/components/plugins-tab.tsx','export'),'billing-code':('packages/views/settings/components/billing-state.ts','export'),'profile-code':('packages/views/settings/components/account-tab.tsx','export'),'feedback-code':('server/internal/handler/feedback.go','func ('),'api':('server/pkg/publicapi/v1/README.md','#'),'comments-code':('server/internal/handler/comment.go','func (')}
for k,(p,s) in mcodes.items():REG['M_'+k]={'path':M/p,'url':'','product':'Multica','kind':'源码' if k!='api' else '文档','label':p,'find':s}
wdocs={'auth':'auth-cloud','home-navigation':'home-navigation','workspace':'workspace','session':'session','experts':'experts','automation':'automation','files-artifacts':'files-artifacts','skills':'skills','connectors':'connectors','memory-compaction':'memory-compaction','knowledge':'knowledge','hitl-permission':'hitl-permission','model-config':'model-config','desktop-shell':'desktop-shell'}
for k,slug in wdocs.items():REG['W_'+k]={'path':W/'invariants'/f'{slug}.md','url':'','product':'MobileWork','kind':'文档','label':'invariants/'+slug+'.md','line':1}
a='apps/app/src/react-app/'
wcodes={'share-code':a+'domains/workspace/share-workspace-access-panel.tsx','access-code':'apps/server/src/server.ts','nav-code':a+'shell/module-nav.tsx','flags-code':a+'kernel/mock-flags.ts','history-code':a+'domains/session/history-questions/history-questions-source.ts','session-menu':a+'domains/session/sidebar/app-sidebar.tsx','message-code':'apps/app/src/components/chat/message-list.tsx','feedback-code':a+'domains/session/chat/message-feedback.tsx','settings-code':a+'domains/settings/mobilework/sections.ts','subagent-code':a+'domains/session/subagent/subagent-aggregate.ts','publish-code':a+'domains/experts/asset-publish/asset-publish-dialog.tsx','skill-try-code':a+'domains/experts/skill-tryout-handoff.ts','voice-code':a+'domains/session/voice/asr/use-asr.ts','browser-code':a+'domains/browser/NavigationBar.tsx','takeover-code':a+'domains/browser/ManualTakeoverButton.tsx'}
for k,p in wcodes.items():REG['W_'+k]={'path':W/p,'url':'','product':'MobileWork','kind':'源码','label':p,'find':{'access-code':'function assertOpencodeProxyAllowed','flags-code':'KNOWLEDGE_CENTER_FORCE_HIDDEN','session-menu':'function SessionActionItems','message-code':'function CopyMessageButton'}.get(k,'export')}
for k,p in [('P_prototype','产品原型.html'),('P_steps','操作步骤.md'),('P_proposal','mobile_work团队版技术方案.html'),('P_design','design/README.md')]:REG[k]={'path':ROOT/p,'url':'','product':'MobileWork 提案输入','kind':'示例' if k!='P_proposal' else '建议','label':p,'line':1}
# 纠正来源标记和实现级别。
for f in FEATURES:
 if f['name']=='编辑已发评论':f['cells'][2]['raw']='有回退到用户消息入口；未核验原地编辑已发团队评论 @W_message-code'
 if f['name']=='@人类成员':f['cells'][2]['raw']='?未核验多成员提及通知'
 if f['name']=='回复人类是否叫 Agent':f['cells'][1]['raw']='直接回复人类不走负责人兜底；明确提及 Agent 才扩展'
 if f['name']=='个人固定入口':f['cells'][2]['raw']='侧栏工作空间与任务列表；任务置顶已见源码菜单 @W_session-menu'
 if f['name']=='置顶会话':f['cells'][2]['raw']='任务菜单置顶/取消置顶，保存于客户端状态；未实机验证同步 @W_session-menu'
 if f['name']=='会话重命名':f['cells'][2]['raw']='任务菜单重命名；取决标题编辑回调接线 @W_session-menu'
 for i,c in enumerate(f['cells']):
  r=re.search(r' @([A-Za-z][\w-]*)$',c['raw']);ref=r[1] if r else c['default_ref'];t=c['raw'][:r.start()] if r else c['raw']
  assert ref in REG,(f['id'],ref)
  status='未核验' if t.startswith('?') else '条件能力' if t.startswith('~') else '入口隐藏' if t.startswith('H') else REG[ref]['kind']
  c.update(text=t.lstrip('?~H'),status=status,ref=ref)
SNAP=O/'资料快照/证据';SNAP.mkdir(exist_ok=True)
for k,s in REG.items():
 p=s['path'];assert p.exists(),str(p)
 text=p.read_text(errors='replace');lines=text.splitlines();s['line']=s.get('line') or next((i+1 for i,l in enumerate(lines) if s.get('find','___') in l),1)
 s['sha256']=hashlib.sha256(p.read_bytes()).hexdigest();s['version']=VERS.get(s['product'],'本地提供材料');s['absolute_path']=str(p)
 if s['product']=='平凯 Loop':s['snapshot']=str(p.relative_to(O))
 else:
  # 文档完整留存；大源码保留头部与关键段，避免复制无关内容。
  if s['kind'] in ['文档','建议','示例'] and p.suffix in ['.md','.mdx']:body=text
  else:
   chosen=set(range(min(20,len(lines))));n=s['line']-1;chosen.update(range(max(0,n-15),min(len(lines),n+125)))
   if k=='W_message-code':
    for needle in ['onRevertToUserMessage','IssueReportMenuItem','CopyMessageButton']:
     hits=[i for i,l in enumerate(lines) if needle in l]
     for j in hits[:3]:chosen.update(range(max(0,j-8),min(len(lines),j+30)))
   body='源文件：'+str(p)+'\n版本：'+s['version']+'\nSHA-256：'+s['sha256']+'\n以下是带原行号的节选，不是完整文件。\n\n'+'\n'.join(f'{i+1:05}  {lines[i]}' for i in sorted(chosen))
  dest=SNAP/(k+'.txt');dest.write_text(body);s['snapshot']=str(dest.relative_to(O))
 s.pop('path');s.pop('find',None)
(O/'sources.json').write_text(json.dumps(REG,ensure_ascii=False,indent=2))
(O/'功能矩阵.json').write_text(json.dumps(FEATURES,ensure_ascii=False,indent=2))
CSS='''*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f6f5f1;color:#1c2330;font:16px/1.75 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}a{color:#2563c9;text-underline-offset:3px}button,input,select{font:inherit}button,select{cursor:pointer}header{position:sticky;top:0;z-index:9;background:#f6f5f1f5;border-bottom:1px solid #e3e1da;padding:12px 24px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}header b{margin-right:auto}header a{font-size:14px}main{max-width:1320px;margin:auto;padding:38px 36px 100px;min-width:0}h1{font-size:34px;line-height:1.35;max-width:1000px;margin:10px 0 20px}h2{font-size:26px;margin:52px 0 16px;line-height:1.4}h3{font-size:20px;margin:24px 0 12px}h4{font-size:17px;margin:8px 0}p{margin:10px 0 18px}.lead{font-size:19px;max-width:980px}.eyebrow,.muted{color:#626a73;font-size:13px}.tag{display:inline-block;font-size:12px;line-height:1.6;padding:2px 8px;margin:2px 5px 3px 0;border-radius:5px;background:#eaf1fd;color:#2563c9}.tag.未核验,.tag.条件能力{background:#fdf1e6;color:#945016}.tag.源码{background:#e6f5f1;color:#0d7564}.tag.入口隐藏{background:#fbeaf0;color:#b33460}.tag.建议{background:#f1edfc;color:#6b55c9}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.card,details,.panel{background:white;border:1px solid #e3e1da;border-radius:12px;padding:20px;min-width:0}.card p:last-child{margin-bottom:0}details{margin:10px 0;padding:13px 18px}summary{cursor:pointer;font-weight:600}details details{border-radius:6px;background:#fbfaf8;margin-left:10px}ul,ol{padding-left:24px}li{margin:7px 0}.callout{border-left:4px solid #6b55c9;background:#f1edfc;padding:18px 22px;margin:22px 0}.boundary{border-left-color:#d06a1c;background:#fdf1e6}.scroll{overflow:auto;max-width:100%;background:white;border:1px solid #e3e1da;border-radius:10px}table{border-collapse:collapse;width:100%;min-width:780px;font-size:14px}th,td{padding:14px 16px;border-bottom:1px solid #e3e1da;vertical-align:top;text-align:left}th{background:#eeede7;position:sticky;top:0;z-index:1}td:first-child{min-width:160px}td{min-width:240px}code{font-size:.88em;background:#eeede7;padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#1c2330;color:#eee;padding:20px;border-radius:9px}.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:20px 0}button,.button{display:inline-block;border:1px solid #d6d3ca;padding:8px 14px;border-radius:7px;background:white;color:#1c2330;text-decoration:none}button:hover,.button:hover{background:#eeede7}button.on,button[aria-pressed=true]{background:#2563c9;color:white;border-color:#2563c9}button:disabled{opacity:.4;cursor:default}input,select{padding:9px;border:1px solid #d6d3ca;border-radius:6px;background:white;max-width:100%}input[type=search]{flex:1;min-width:180px}section{scroll-margin-top:100px}.featureleaf{font-size:14px;border-top:1px solid #eee;padding:10px 0}.featureleaf b{display:block}.cite{font-size:11px;white-space:nowrap;margin-left:5px}.pillrow{display:flex;flex-wrap:wrap;gap:8px}.pillrow a{padding:4px 10px;border-radius:5px;background:#eeede7;font-size:13px}.seq svg{display:block;max-width:none}.seq{position:relative}.seq .event{transition:opacity .15s}.seq .event.dim{opacity:.18}.seq .event.hot text{font-weight:bold;fill:#2563c9}.seq-note{min-height:66px;padding:12px 16px;background:#eaf1fd;border-radius:8px}.diagram img{display:block;max-width:100%;height:auto}.matrixwrap{max-height:76vh}.matrix td:nth-child(n+2){width:28%}footer{margin-top:60px;border-top:1px solid #ddd;padding-top:20px;font-size:13px;color:#626a73}.statusline{font-size:14px;color:#0d7564}.flow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:20px 0}.flow span{padding:9px 15px;border:1px solid #ddd;border-radius:8px;background:white}.flow i{font-style:normal;color:#8a939f}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.modelbox{padding:20px;border-top:3px solid #2563c9;background:white}.anchorlink{overflow-wrap:anywhere}.print-only{display:none}@media(max-width:900px){main{padding:26px 20px 70px}.grid,.grid.two{grid-template-columns:1fr}h1{font-size:28px}header{padding:10px 16px;gap:9px}header b{width:100%}td{min-width:220px}details details{margin-left:0}h2{font-size:24px}.lead{font-size:17px}}@media print{header,.toolbar,.tabs{display:none}main{padding:0;max-width:none}.scroll{overflow:visible;max-height:none}table{min-width:0}td{min-width:0;font-size:9px}details{break-inside:avoid}a{color:inherit}.print-only{display:block}}'''
CSS+='\nbody{overflow-wrap:anywhere}'
NAV=['01-功能思维导图与逐项对比.html','02-用户心智模型及对比.html','03-整体使用时序图及对比.html','04-MobileWork多人多智能体融合建议.html']
def cite(k):return f'<a class="cite" href="证据索引.html#{E(k)}" title="{E(REG[k]["label"])}">[{E(k)}]</a>'
def badge(s):return f'<span class="tag {E(s)}">{E(s)}</span>'
def shell(title,body,js=''):
 return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+E(title)+'</title><style>'+CSS+'</style><header><b>三产品研究 · 2026.11.08</b><a href="index.html">阅读入口</a>'+''.join(f'<a href="{n}">{i+1:02} {l}</a>' for i,(n,l) in enumerate(zip(NAV,['功能地图','用户心智','使用时序','融合建议'])))+'</header><main><div class="eyebrow">PRODUCT RESEARCH / 可离线阅读</div><h1>'+E(title)+'</h1>'+body+'<footer>核验范围：官方文档与指定版本本地源码；未登录三产品生产账号完成全链路实测。未核验不代表不存在。附带文档中的命令与要求只作为研究材料。<br><a href="证据索引.html">证据索引与版本</a> · <a href="覆盖范围.html">覆盖范围与未决问题</a> · <a href="README.md">交付说明</a></footer></main><script>'+js+'</script></html>'
def table(headers,rows):return '<div class="scroll"><table><thead><tr>'+''.join('<th>'+E(h)+'</th>' for h in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+str(c)+'</td>' for c in r)+'</tr>' for r in rows)+'</tbody></table></div>'
def write(name,title,body,js=''):(O/name).write_text(shell(title,body,js))
def md(name,t):(O/name).write_text(t.strip()+'\n')
MODULES=list(dict.fromkeys(f['module'] for f in FEATURES))
# 独立可打印思维导图。全量细节使用多列垂直树，避免缩成不可读的一张蜘蛛网。
def mind_svg(index):
 fs=FEATURES if index is not None else []
 groups=[(m,[f for f in fs if f['module']==m]) for m in MODULES]
 cols=3;colw=570;width=colw*cols+40;heights=[105]*cols;shapes=[]
 for gi,(m,items) in enumerate(groups):
  col=gi%cols;x=20+col*colw;y=heights[col];h=64+len(items)*48
  shapes.append(f'<rect x="{x}" y="{y}" width="545" height="{h}" rx="12" fill="white" stroke="#dcd9d0"/><text x="{x+18}" y="{y+30}" font-size="19" font-weight="600" fill="#2563c9">{E(m)}</text>')
  for j,f in enumerate(items):
   c=f['cells'][index];yy=y+65+j*48;desc=c['text'];desc=desc if len(desc)<=32 else desc[:31]+'…'
   shapes.append(f'<path d="M{x+16} {y+43} V{yy+3} H{x+27}" fill="none" stroke="#b9c8dc"/><text x="{x+35}" y="{yy}" font-size="14" fill="#1c2330">{E(f["id"]+" "+f["name"])}</text><text x="{x+35}" y="{yy+18}" font-size="11" fill="#626a73">{E(c["status"]+" · "+desc)}</text>')
  heights[col]+=h+22
 height=max(heights)+30
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" style="font-family:PingFang SC,Microsoft YaHei,sans-serif"><rect width="100%" height="100%" fill="#f6f5f1"/><text x="25" y="43" font-size="27" font-weight="600">{E(PRODUCTS[index])} · 全功能树</text><text x="25" y="76" font-size="14">{len(FEATURES)} 个对照项；待核验分支不是已确认功能；完整文本与证据见文档 01。</text>'+''.join(shapes)+'</svg>'
for i,p in enumerate(PRODUCTS):
 (O/'图源'/f'{p}-全功能树.svg').write_text(mind_svg(i))
 mm=['mindmap',f'  root(({p}))']
 for m in MODULES:
  mm.append('    '+m)
  for f in FEATURES:
   if f['module']==m:mm.append('      '+f['id']+' '+f['name']+'【'+f['cells'][i]['status']+'】')
 (O/'图源'/f'{p}-全功能树.mmd').write_text('\n'.join(mm))
# 关系图 SVG 和 Mermaid，按产品区分实体语义。
RELATIONS=[
('平凯 Loop',[('组织 / 工作区','频道 1:N','权限与归属'),('频道','DM / 回复话题','会话上下文'),('频道','任务 1:N','任务恰属一频道'),('任务','讨论 / 进展 / 产物','持续工作记录'),('Agent Team','Agent 1:N','创建者个人所有'),('Machine + runtime','Agent 执行','机器位置≠身份')]),
('Multica',[('工作区','项目 / 事项','项目可选'),('项目','事项 1:N','事项至多一个项目'),('事项','评论 / 子事项','子状态独立'),('事项','Run 1:N','执行结果≠业务完成'),('Squad','人 + Agent','leader 必须 Agent'),('Runtime','Agent / Run','Access 与本机权限分开')]),
('MobileWork',[('账号','本地 / 远程工作空间','目录或连接'),('工作空间','任务 Session 1:N','本地新任务建子目录'),('Session','消息 / 回合 1:N','持续对话'),('主专家','子代理 / 专家团','执行拆分'),('回合 / 子会话','工具 / 浏览器 / 文件','引擎实际执行'),('自动化','独立 Session','每次触发新对话')])]
def relation_svg(title,pairs):
 out=['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="575" viewBox="0 0 1000 575" style="font-family:PingFang SC,Microsoft YaHei,sans-serif"><rect width="100%" height="100%" fill="#f6f5f1"/>','<defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#2563c9"/></marker></defs>',f'<text x="25" y="36" font-size="24">{E(title)} · 对象关系</text>']
 for i,(a,b,label) in enumerate(pairs):
  y=65+i*81
  out += [f'<rect x="25" y="{y}" width="280" height="55" rx="8" fill="#f1edfc" stroke="#cfc7ed"/><text x="165" y="{y+34}" text-anchor="middle" font-size="17">{E(a)}</text>',f'<path d="M305 {y+28} H665" stroke="#2563c9" marker-end="url(#a)"/><text x="480" y="{y+20}" text-anchor="middle" font-size="14" fill="#2563c9">{E(label)}</text>',f'<rect x="680" y="{y}" width="290" height="55" rx="8" fill="#e6f5f1" stroke="#b3d9d2"/><text x="825" y="{y+34}" text-anchor="middle" font-size="17">{E(b)}</text>']
 return ''.join(out)+'</svg>'
for p,pairs in RELATIONS:
 (O/'图源'/f'{p}-对象关系.svg').write_text(relation_svg(p,pairs))
 (O/'图源'/f'{p}-对象关系.mmd').write_text('flowchart LR\n'+'\n'.join(f'  a{i}["{a}"] -->|"{l}"| b{i}["{b}"]' for i,(a,b,l) in enumerate(pairs)))
intro='''<p class="lead">三个产品都能让 Agent 干活，但它们让用户持续管理的对象不同：Loop 从协作会话推进任务，Multica 围绕事项组织执行，MobileWork 围绕个人工作空间完成任务对话。</p><div class="callout">不要直接用“任务”“团队”“工作流”同名词做等价比较。下面将业务对象、执行对象、通知对象拆开，再比较每一个动作。</div>'''
body=intro+'<section id="overview"><h2>01 / 同一套对照口径，保留产品差异</h2>'+table(['维度']+PRODUCTS,[['核心工作对象','频道 / 话题 → task','issue → run','workspace → session / turn'],['协作团队','工作区成员；Agent Team 仅 Agent 且创建者私有','工作区成员；Squad 可含人和 Agent','专家团是执行资产；多人项目闭环本次未核验'],['工作流','条件开放的通用图流程；文档与价格页有冲突','按项目状态交接负责人','本地定时自动化与独立任务'],['最应保留的优势','上下文讨论、回源公告、消息投递解释','事项责任、Run 审计、权限与评论精细度','个人桌面执行、浏览器接管、文件交付与专家资产']])+'</section>'
body+='<section id="maps"><h2>02 / 三套完整功能树</h2><p>每棵树按相同的 19 个模块、289 个最小对照项组织。树中“未核验”分支用于暴露研究盲区；不能算作已具备能力。展开后可读完整机制与证据；SVG 用于放大查看或打印，Mermaid 用于二次编辑。</p><div class="toolbar"><button id="expand">展开全部模块</button><button id="collapse">收起全部模块</button></div>'
for i,p in enumerate(PRODUCTS):
 body+=f'<details class="producttree" id="tree-{i}"><summary>{p} · 19 个模块 / 289 个对照点</summary><p><a href="图源/{p}-全功能树.svg">完整 SVG 功能树</a> · <a href="图源/{p}-全功能树.mmd">Mermaid 源图</a></p>'
 for m in MODULES:
  items=[f for f in FEATURES if f['module']==m]
  body+=f'<details class="modtree"><summary>{E(m)} · {len(items)} 项</summary>'
  for f in items:
   c=f['cells'][i];body+=f'<div class="featureleaf"><b>{f["id"]} · {E(f["name"])}</b>{badge(c["status"])}{E(c["text"])}{cite(c["ref"])}</div>'
  body+='</details>'
 body+='</details>'
body+='</section><section id="relations"><h2>03 / 模块之间如何关联</h2><p>以下关系分为归属、上下文、责任、执行和授权。一个对象进入另一对象的上下文，不等于获得它的权限；一轮执行完成，也不等于业务验收通过。</p>'
for i,(p,pairs) in enumerate(RELATIONS):
 body+=f'<details><summary>{p} · 对象关系与边界</summary><div class="diagram"><img loading="lazy" src="图源/{p}-对象关系.svg" alt="{p} 对象关系"></div><p>'+''.join(cite(k) for k in [['L_channels','L_teams','L_roles-runtime'],['M_projects','M_tasks','M_squads'],['W_workspace','W_session','W_experts']][i])+f'<a href="图源/{p}-对象关系.mmd">可编辑图源</a></p></details>'
DEP=[
('01 账户与空间 → 02 权限 / 03 导航','身份决定工作区成员资格，导航只呈现有权入口','团队空间容纳项目/事项与成员','账号隔离 + 本地/远程空间；不等于团队成员容器'),
('02 权限 → 04/07/09/12/15','私有频道成员与 Agent 共享分别检查','项目/事项权限、Agent Access、runtime Access 分开','远程令牌作用域 + 本地工具授权；专家团队权限待补'),
('03 搜索 → 04/05/07/13/17','搜索会话/消息，hot 历史和频道范围限制','任务/评论搜索 + 项目视图；私聊独立','任务/历史提问/文件查找；不是共享事项检索'),
('04 协作容器 → 05 消息 → 07 工作','频道 → 话题 → 单频道任务，保存来源','项目/事项评论与私人 Chat 分开','workspace → session；未核验原生团队频道'),
('05 评论 → 06 路由 / 13 附件 / 17 通知','消息、reaction、任务讨论各有行为','同根回复、批注、结论影响路由和通知','问答、赞踩、回退属于个人会话机制'),
('06 路由 → 09 Agent → 15 执行','按真实提及、协作范围与任务讨论唤醒','按提及/回复/负责人规则预览并触发','发送给主专家；忙碌时排队，人工介入优先'),
('07 工作 → 08 项目 / 13 产物 / 15 执行','任务有状态、讨论、子项与产物；状态与活动分开','issue 有稳定身份，归可选项目并经历多次 run','session/turn 是任务执行载体；共享业务事项待补'),
('08 项目 → 07 工作 / 14 流程 / 12 资源','频道任务 hub 与根任务已核验，独立 Project 边界待核验','项目聚合事项，装配说明/代码资源与状态交接','空间组织目录与任务；不是已确认团队 Project'),
('09 Agent ← 11 资产 / 12 工具 / 18 模型','身份/role/runtime 分开，资源修改保存重启','Agent 绑定 runtime，能力与 Access 分开','专家是全局资产；每次发送装配专家/模型/工具'),
('10 团队 → 09 Agent / 06 分派','Team 仅 Agent，个人创建者所有；成员偏好影响唤醒','Squad 含人/Agent，Agent leader 先执行再受控委派','专家团主/成员服务于执行，不代替多人责任组织'),
('11 资产/知识 → 09 配置 / 15 上下文','角色、技能、记忆分别配置，不能互相代替','技能资产供 Agent 使用；项目资源装配上下文','技能设备安装账号启用，记忆账号级，知识入口隐藏'),
('12 外部工具 ↔ 15 执行 / 13 成果','连接器/自建应用需授权；异步 202 不等于回答','runtime 工具/MCP、渠道、仓库/API 各自接入','MCP 定义/密钥/空间连接/本次授权四层分开'),
('13 文件 ← 05 附件 / 07 工作 / 15 输出','任务讨论与产物关联；来源公告显式同步','描述附件作为输入，评论附件可成为产物并保留版本','任务目录与成果注册，删除任务保留磁盘文件'),
('14 自动化 → 06 触发 / 07 工作 / 15 执行','跟进消息和图工作流不同，后者权益待核验','Autopilot 建事项/仅运行与项目状态交接不同','本地定时触发独立会话，不是多人工作流'),
('15 执行 ← 06/14；→ 13/17','Machine/runtime 可用性影响 Agent 活动，结果回任务','队列绑定 runtime，运行日志与结果回同一事项','引擎回合/子会话与错误、工具、成果联动'),
('16 治理 → 02 权限 / 12 工具 / 15 运行','频道/Agent 访问和流程审批分开；不推断 OS 沙箱','Agent Access 不等于 OS 隔离；运行费用有估算边界','HITL/沙箱/审核约束执行；工具许可不等于验收'),
('17 通知 ← 05/07/15；→ 03 注意力入口','Watcher/任务公告/消息未读帮助关注进展','订阅与直接提及合并进人类收件箱，Agent 不读收件箱','个人任务忙碌/异常提示已有；团队订阅模型待补'),
('18 模型/输入/浏览器 → 09/15；→ 13','模型依运行选项；原生浏览器/语音部分待核验','模型与浏览器能力多由 runtime 工具提供','就绪状态、语音、原生浏览器与接管服务任务执行'),
('19 偏好/帮助 → 01/03/16','个人偏好、帮助、连接排障辅助主链路','账号/设备偏好、快捷键与反馈配置分开','设置八分区、更新/后台、帮助/上报；隐藏入口另标')]
body+='<h3>19 个模块的跨模块依赖</h3><p>下表是基于功能机制归纳的关系索引。箭头表示归属、输入依赖、读取或触发，具体含义写在单元格中；它不暗示三个产品拥有同构模块或自动完成所有交接。</p>'+table(['关系（模块编号）']+PRODUCTS,DEP)
body+='<p>主要依据：'+''.join(cite(k) for k in ['L_channels','L_working','L_teams','L_resources','L_workflows','M_issues','M_tasks','M_mentioning-agents','M_projects','M_agents','W_workspace','W_session','W_experts','W_connectors','W_flags-code'])+'</p>'
body+='</section><section id="matrix"><h2>04 / 逐项功能矩阵</h2><p>“源码”表示看到实现路径，并非运行成功证明；“文档”表示官方描述或当前产品约束；“条件能力”需要部署、版本、权益或工具支持；“入口隐藏”表示保留实现但当前入口被关闭。单元格中的局部待核验以正文为准。</p><div class="toolbar"><input id="search" type="search" aria-label="搜索功能与机制" placeholder="搜索：回复、批注、唤醒、权限、验收…"><select id="module" aria-label="筛选模块"><option value="">全部模块</option>'+''.join(f'<option>{E(m)}</option>' for m in MODULES)+'</select><select id="status" aria-label="筛选证据状态"><option value="">全部证据状态</option>'+''.join(f'<option>{s}</option>' for s in ['未核验','条件能力','入口隐藏','源码','文档'])+'</select><button id="clear">清除筛选</button><a class="button" href="功能矩阵.json" download>下载 JSON</a></div><p id="count" class="statusline" role="status"></p><div class="scroll matrixwrap"><table class="matrix"><thead><tr><th>功能 / 模块</th>'+''.join(f'<th>{p}</th>' for p in PRODUCTS)+'</tr></thead><tbody id="rows">'
for f in FEATURES:
 body+=f'<tr id="{f["id"]}" data-module="{E(f["module"])}" data-status="{E(" ".join(c["status"] for c in f["cells"]))}"><td><b>{f["id"]} {E(f["name"])}</b><br><span class="muted">{E(f["module"])}<br>{E(f["sub"])}</span></td>'+''.join('<td>'+badge(c['status'])+'<br>'+E(c['text'])+cite(c['ref'])+'</td>' for c in f['cells'])+'</tr>'
body+='</tbody></table></div></section><section><h2>05 / 影响选型的差异</h2><ol><li>当沟通本身就是工作现场，Loop 的频道、回复话题、任务与回源公告更贴近群体协作习惯；仍需确认实际版本的工作流权益。</li><li>当事项需要经历分派、执行、评审、返工和追溯，Multica 对 issue、run、评论路由与 Access 的分层更明确。</li><li>当价值主要发生在个人桌面，MobileWork 的本地目录、专家资产、原生浏览器与成果预览可复用；新增团队空间应补独立责任与验收对象。</li><li>不要按“已确认功能数”打产品分。三边证据不对称，且单个完整责任链的价值高于多个孤立控件。</li></ol></section>'
js='''const rows=[...document.querySelectorAll('#rows tr')];function filter(){let q=document.querySelector('#search').value.trim().toLowerCase(),m=document.querySelector('#module').value,s=document.querySelector('#status').value;let n=0;rows.forEach(r=>{r.hidden=!!((q&&!r.textContent.toLowerCase().includes(q))||(m&&r.dataset.module!==m)||(s&&!r.dataset.status.includes(s)));if(!r.hidden)n++});document.querySelector('#count').textContent=`显示 ${n} / ${rows.length} 项；每项并列对照三个产品。`}['search','module','status'].forEach(id=>document.getElementById(id).addEventListener(id==='search'?'input':'change',filter));document.querySelector('#clear').onclick=()=>{['search','module','status'].forEach(id=>document.getElementById(id).value='');filter()};document.querySelector('#expand').onclick=()=>document.querySelectorAll('.producttree,.modtree').forEach(d=>d.open=true);document.querySelector('#collapse').onclick=()=>document.querySelectorAll('.producttree,.modtree').forEach(d=>d.open=false);filter();'''
write(NAV[0],'功能地图：从模块到评论、回复与执行路由',body,js)
mdlines=['# 功能思维导图与逐项对比','\n研究日期：2026-11-08。完整交互版见同名 HTML。\n','核心区别：Loop 围绕协作会话，Multica 围绕事项与执行，MobileWork 围绕个人工作空间与任务对话。未核验不代表不存在。','\n## 对象关系']
for p,pairs in RELATIONS:
 mdlines+=['\n### '+p]+[f'- {a} → {b}：{l}' for a,b,l in pairs]
for m in MODULES:
 mdlines+=['\n## '+m,'\n| 功能 | 平凯 Loop | Multica | MobileWork |','|---|---|---|---|']
 for f in FEATURES:
  if f['module']==m:mdlines.append('| '+f['id']+' '+f['name']+' | '+' | '.join('【'+c['status']+'】'+c['text']+f' [{c["ref"]}](证据索引.html#{c["ref"]})' for c in f['cells'])+' |')
mdlines+=['\n## 全模块依赖关系','\n| 关系 | Loop | Multica | MobileWork |','|---|---|---|---|']+['| '+' | '.join(r)+' |' for r in DEP]
md('01-功能思维导图与逐项对比.md','\n'.join(mdlines))
# 02：保留技能模板的手工构图与交互，改为三产品的共同解释框架，再扩展独立心智模型。
SK=Path('/Users/xymtop/.codex/skills/guided-html-explainer')
d=json.load(open(SK/'assets/example.json'))
d.update(title='先确认你在推进哪件工作，再决定是否叫醒 Agent',shortTitle='三产品 · 用户心智对照',thesis='Loop 让用户从「共同讨论」进入任务；Multica 让用户围绕「持续事项」调度多次执行；MobileWork 让用户在「个人工作空间」通过任务对话获得成果。用户看到相似的输入框，背后的责任、通知与执行含义却不同。',scope='2026-11-08；Loop 官方文档快照、Multica 与 MobileWork 指定版本源码及产品约束。下述人物、编号、缺陷与结果均为讲解示例，不是实测日志。详见证据索引和覆盖范围。',case='贯穿示例：王蕾负责弱网重复待办问题，周启明开发、陈晓独立回归；修复助手与测试助手参与。示例 W17 表示待完成的工作，R1/R2 表示两次执行，不代表三产品都有相同对象。',storyTitle='同一个缺陷，从提出需求到人工验收',storyLead='每一步对照用户期待、系统对象与留下的证据。示例按已核验机制编排；生产账号可用性仍需单独验证。')
d['diagram']['groups'][1]['label']='协作与工作记录 · 各产品语义不同'
d['diagram']['groups'][3]['label']='执行环境 · 工具与实际副作用'
d['diagram']['groups'][2]['label']='工作记录 · 身份、状态与证据'
d['roleDescriptions']={'human':'人表达意图、选择入口并判断成果。','server':'产品决定这次输入归哪件工作，以及是否启动执行。','data':'记录上下文、运行状态、成果位置；对象因产品而异。','edge':'机器、工具与外部系统实际产生文件或业务变化。','agent':'按上下文和授权调用工具。'}
N={
'person':('王蕾 / 周启明 / 陈晓','提出问题 · 开发 · 验收','三人对同一业务目标负责，但操作权限与执行身份需分别识别。','王蕾组织弱网问题修复；周启明提交变更；陈晓用测试证据确认是否修好。','人物分工是示例，不代表产品预置这些角色。',['CASE']),
'entry':('用户选择的入口','频道 / 事项 / 任务对话','承接需求与后续追问。','Loop 在频道或话题进入；Multica 在事项评论或私聊进入；MobileWork 在工作空间新建任务对话。','同为输入框，普通留言不一定都启动 Agent。',['L_channels','M_comments','W_session']),
'service':('上下文与工作归属','先定位对象 · 再决定动作','决定信息属于哪条协作主线。','Loop 的 task 归单频道；Multica 的 issue 可归一个项目；MobileWork 的 session 绑定工作空间与任务目录。','个人会话不是共享事项；引用另一个对象不自动获得其权限。',['L_channels','M_projects','W_workspace']),
'dispatch':('责任与执行路由','通知谁 · 唤醒谁 · 是否启动','将一次输入解释成人类协作或执行请求。','Loop 按协作面与提及投递；Multica 按回复、提及、负责人规则触发；MobileWork 用户消息交给所选主专家。','通知、指派、运行三件事分开；管理员不自动拥有所有 Agent 调用权。',['L_working','M_mentioning-agents','M_agents','W_experts']),
'records':('持续工作与执行痕迹','Task / Issue+Run / Session+Turn','让人找回需求、进展和成果。','Multica 明确一事项多次运行；Loop 留任务讨论与进展；MobileWork 保留消息、工具与成果。','此图为跨产品解释框架，不主张三边有同一种数据库或运行模型。',['L_channels','M_tasks','W_session']),
'loader':('可用执行环境','Machine / Runtime / 本地引擎','提供真正能干活的机器与工具。','执行前需机器在线、身份与工具授权可用；具体条件以各产品规则为准。','机器在线不等于 Agent 空闲；共享 Agent 不等于获得机器文件系统隔离。',['L_machine-client','M_daemon-runtimes','W_hitl-permission']),
'worker':('Agent 与工具执行','修复 · 浏览器操作 · 测试','把需求变成文件或外部动作。','修复助手生成补丁；测试助手执行回归。MobileWork 可复用原生浏览器和手动接管。','子代理并行不等于多个人对工作负责；工具许可也不是业务验收。',['M_tasks','W_takeover-code','W_subagent-code']),
'report':('输出与失败回交','变更 / 报告 / 错误原因','让执行结果可见并能再次处理。','输出随任务/事项呈现，失败提供错误或人工处理入口；R1 失败后示例再发起 R2。','停止、回退或重试不自动撤销外部副作用。',['L_rewind','M_tasks','W_files-artifacts']),
'status':('用户判断与验收','看成果 · 对照标准 · 决定下一步','用户判断目标是否真正达成。','Loop Browser 用 In Review 与讨论；Multica 可交人评审并更新事项；MobileWork 由当前用户检查成果。','生成完成不代表业务通过；MobileWork 多成员验收记录属于后续建议。',['L_working','M_workflows','W_session'])}
for n in d['nodes']:
 title,sub,what,how,boundary,ev=N[n['id']];n.update(label=title,sub=sub,what=what,how=how,boundary=boundary,evidence=ev)
labels=['表达需求','内容 / 意图','定位工作','留下记录','受控交接 / W17','装配上下文','执行出结果','结果 / 错误','读取证据','继续或返工']
for edge,label in zip(d['edges'],labels):edge['label']=label
for n in d['nodes']:
 if n['id']=='records':n.update(y=456,h=62)
for edge in d['edges']:
 if edge['to']=='records':edge['path']='M477 286 L477 454'
 if edge['from']=='records':edge['path']='M312 487 L266 487 L266 368 L220 368'
# 工作记录箭头保留原布局，语义改为跨产品关系示意。
d['insights']=[{'title':'输入框不等于同一种承诺','text':'在 MobileWork 发消息通常意味着启动本轮任务；在团队评论里，人常常只想留意见。必须让“留言”和“派工”可被预测。'},{'title':'工作对象要跨越多次执行','text':'R1 写出补丁后测试失败，W17 仍未完成。Multica 的 issue/run 分层最清楚；Loop 任务也不等于 Agent 活动。'},{'title':'团队不是多个 Agent 的别名','text':'Loop Agent Team 只有 Agent 且由创建者个人掌控；Multica Squad 可含人；MobileWork 专家团主要解决执行组织。'}]
stepdata=[
('提出弱网缺陷','王蕾','在所选入口写复现步骤、预期仅一条待办、实际出现两条。','Loop 先形成话题；Multica 创建事项；MobileWork 首次发送创建 session 并开始任务。',['共同目标：消除重复待办','三产品的工作主键不同，不能互换'],['person','entry','service'],['L_channels','M_issues','W_home-navigation']),
('明确由谁处理','王蕾 / 周启明','选择修复助手，并约定陈晓回归。','Loop 指派/提及需按投递规则；Multica 可以只指派暂不开始；MobileWork 选择主专家，仍未形成多成员负责人模型。',['示例责任：周启明修复，陈晓回归','调用 Agent 与人类责任分开'],['entry','service','dispatch'],['L_working','M_assigning-issues','W_experts']),
('执行第一版','修复助手','看到执行活动、补丁 v1 与工具状态。','可用执行环境读取上下文并运行；本地工具可能需要权限确认。',['示例 R1 生成补丁 v1','工具授权仅允许操作，不代表批准补丁'],['dispatch','loader','worker','records'],['L_operate','M_tasks','W_hitl-permission']),
('测试发现仍重复','陈晓 / 测试助手','回归证据显示预期 1、实际 2，需要返工。','讨论或评论记录原因；Multica 可按工作流交回开发；MobileWork 当前由用户在任务里追问，团队回归闭环属于建议。',['示例 QA1：失败','W17 未通过验收；R1 有输出仍不算完成'],['worker','report','records','status'],['L_channels','M_workflows','W_session']),
('返工并再次验证','周启明 / 修复助手 / 陈晓','生成补丁 v2，再跑同一弱网场景。','重新触发后续执行并保留证据；不把回退聊天误认为撤销已写文件。',['示例 R2 → 补丁 v2','示例 QA2：预期 1、实际 1'],['dispatch','worker','report','records'],['L_rewind','M_tasks','W_session']),
('人工判断完成','王蕾','查看 v2、回归结果与业务标准，明确通过。','Loop Browser 用任务状态和讨论；Multica 由有权操作者推进事项；MobileWork 当前是用户对个人成果的判断。',['示例 W17 通过','多人审批证据对象是 MobileWork 的新增建议'],['status','records','entry'],['L_working','M_workflows','W_files-artifacts'])]
d['steps']=[dict(zip(['title','actor','visible','system','changes','active','evidence'],x)) for x in stepdata]
d['modules']=[
 dict(title='协作容器：让“大家在说哪件事”有边界',why='人需要先找到共同上下文，才能判断一条回复是局部讨论还是全局进展。',how='Loop 用频道与回复话题；Multica 用项目和事项；MobileWork 目前用个人工作空间与任务会话。',boundary='组织成员资格、私有会话可见性和 Agent 调用权限不是同一个集合。',input='复现资料、需求、参与者',output='有归属的讨论与工作入口',depends='身份、成员资格与上下文访问校验',evidence=['L_channels','M_projects','W_workspace']),
 dict(title='派工路由：把“请看看”变成可解释的动作',why='一条评论可能只想通知人，也可能要启动机器；隐式执行会制造噪声与费用。',how='Loop 有投递诊断与加急；Multica 有触发预览、/note 与按作者/线程的路由；MobileWork 每条任务用户消息进入主专家回合。',boundary='提及不一定更换负责人；reaction 不等于新消息或启动工作。',input='评论、真实提及、指派或定时触发',output='人类通知、执行请求或仅保存意见',depends='目标权限、Agent 可用性、任务状态与当前运行',evidence=['L_features','M_mentioning-agents','M_comments','W_session']),
 dict(title='执行反馈：让人知道是“在跑”还是“修好了”',why='模型能输出内容，并不代表文件正确或缺陷消失。',how='查看运行活动和产物，再由独立测试验证同一场景；必要时返工并保留后续执行。',boundary='工具审批只准许动作；业务验收需业务责任人判断；外部副作用不随会话回退撤销。',input='执行日志、补丁与测试结果',output='继续、返工、失败处置或业务通过',depends='成果定位、错误可见性与责任记录',evidence=['L_rewind','M_tasks','W_hitl-permission'])]
d['comparisons']=[dict(title=t,left=a,right=b,difference=c) for t,a,b,c in [
('留言 / 派工','留言保存给人看的意见','派工请求 Agent 实际执行','MobileWork 加团队能力时，需要显式区分这两个意图。'),('工作 / 一次执行','W17 持续承载目标与责任','R1、R2 承载两轮执行与错误','一次执行结束不能隐式覆盖业务验收结论。'),('团队 / 执行组合','多个人有不同责任与权限','多个 Agent 共同产出','专家团不能直接替代成员、负责人、审批与审计。'),('工具授权 / 业务验收','允许某次工具修改文件','确认修改满足业务标准','两种决策必须显示不同操作者、对象和结果。')]]
d['failures']=[dict(title='提及了 Agent，却没有启动',trigger='目标未共享、权限不足或运行环境不可用。',detect='Loop 查看投递诊断；Multica 查看触发预览与运行；MobileWork 查看模型/连接就绪与任务错误。',recover='由有权人补共享或修复连接，再显式发起；不通过管理员身份假定能越权调用。',limit='不能从输入框出现名字推断目标已收到或执行已开始。',evidence=['L_working','M_agents','W_model-config']),dict(title='第一版完成，回归仍失败',trigger='R1 有产物，但弱网重复问题仍复现。',detect='陈晓拿 v1 按相同复现步骤回归，保留预期与实际差异。',recover='记录具体失败原因，交回修复人；R2 使用明确的新输入与版本。',limit='此处 QA 分工是场景示例，MobileWork 多人交接机制尚待建设。',evidence=['CASE','M_workflows','W_session']),dict(title='点了停止，文件仍发生过变化',trigger='停止前，某个写文件或外部调用已成功。',detect='核对文件版本和工具记录，不能只看聊天状态。',recover='由操作者评估差异并采取补偿或新执行，保留原因。',limit='三产品本次均未建立“聊天回退就撤销所有外部副作用”的证据。',evidence=['L_rewind','M_tasks','W_session'])]
d['quizzes']=[dict(question='修复助手结束 R1 并输出补丁，是否可以认定弱网问题已完成？',options=['可以，运行已结束','需核对回归证据并由责任人验收','看到最后一条消息就可以'],answer=1,explanation='执行结束只说明这一轮停止，业务目标是否实现要看证据与验收。'),dict(question='MobileWork 专家团已有多个 Agent，是否等于多人协作项目已经具备？',options=['等于，多 Agent 就是多成员','不等于，还缺成员责任、共享工作对象与验收记录'],answer=1,explanation='执行的组织方式与人类协作的权责模型是两层能力。')]
d['takeaways']=['从工作入口问起：我现在是在团队讨论、持续事项，还是个人任务对话？','发送前确认谁会被通知、谁会执行、是否改变负责人和状态。','验收时同时看输入、执行、产物版本与测试证据，不只看完成文案。','要补多人能力，先补持续工作对象和可追责决策，再开放多 Agent 自动协作。']
keys=sorted({k for n in d['nodes']+d['steps']+d['modules']+d['failures'] for k in n['evidence']})
d['sources']=[dict(id=k,kind=REG[k]['kind'],label=REG[k]['product']+' · '+REG[k]['label'],url=REG[k]['url'],note='版本 '+REG[k]['version']+'；原始路径 '+REG[k]['absolute_path']+':'+str(REG[k]['line'])+'。离线快照见证据索引。') for k in keys if k!='CASE']+[dict(id='CASE',kind='示例',label='弱网重复待办修复',url='',note='人物、编号、执行与测试结果均为讲解示例，参考用户提供的本地原型；未实际运行业务。')]
(O/'lesson.json').write_text(json.dumps(d,ensure_ascii=False,indent=2))
subprocess.run(['python3',str(SK/'scripts/build.py'),str(O/'lesson.json'),str(O/NAV[1])],check=True)
# 心智模型不是数据架构：每图表达人的目标、入口、行为与反馈闭环。
MENTALS=[
('平凯 Loop',['先让团队理解问题','在频道提出弱网缺陷','回复话题收束讨论','任务记录责任与进度','修复 / 测试 Agent 执行','看证据并回主线同步'],['共同目标','协作现场','局部上下文','单频道任务','可见活动与产物','人工判断 + 显式公告']),
('Multica',['先把问题变成事项','项目中放入缺陷目标','事项说明与评论澄清','选人 / Agent / Squad','Run 记录每轮执行','评审返工并推进事项'],['稳定工作编号','项目是组织容器','评论可触发执行','一个当前负责人','多轮不覆盖工作身份','业务状态独立']),
('MobileWork',['先选择工作空间','输入需求并选专家','任务对话持续追问','主专家调用子代理','浏览器 / 文件形成成果','用户检查成果再决定'],['个人要办成的事','目录或远程连接','Session 是任务载体','执行组织','本地工具与预览','团队验收是新增建议'])]
def mental_svg(p,titles,subs):
 coords=[(30,65),(365,65),(700,65),(700,330),(365,330),(30,330)];colors=['#6b55c9','#2563c9','#0d8a76','#2563c9','#c03a68','#0d8a76']
 out=[f'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="490" viewBox="0 0 1000 490" style="font-family:PingFang SC,Microsoft YaHei,sans-serif"><rect width="100%" height="100%" fill="#f6f5f1"/><text x="30" y="35" font-size="23">{E(p)} · 用户如何理解一次工作</text><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#8290a0"/></marker></defs>']
 for path,label,x,y in [('M300 110H362','进入',330,96),('M635 110H697','组织',665,96),('M835 155V327','推进',865,245),('M700 375H638','执行',670,361),('M365 375H303','检查',335,361),('M165 330V157','返工 / 新需求',220,245)]:out.append(f'<path d="{path}" fill="none" stroke="#8290a0" stroke-width="2" marker-end="url(#ar)"/><text x="{x}" y="{y}" font-size="13" text-anchor="middle" fill="#626a73">{label}</text>')
 for i,((x,y),t,s,c) in enumerate(zip(coords,titles,subs,colors)):out.append(f'<rect x="{x}" y="{y}" width="270" height="90" rx="10" fill="white" stroke="{c}"/><text x="{x+15}" y="{y+32}" font-size="17" fill="{c}">{i+1:02} {E(t)}</text><text x="{x+15}" y="{y+61}" font-size="13" fill="#626a73">{E(s)}</text>')
 out.append('<text x="30" y="465" font-size="13" fill="#626a73">示例闭环；箭头表达用户理解与动作顺序，不表示每一步都是产品自动执行。</text></svg>');return ''.join(out)
for p,tt,ss in MENTALS:(O/'图源'/f'{p}-用户心智.svg').write_text(mental_svg(p,tt,ss))
SCENARIOS=[
 dict(name='写一条普通回复',intent='我只想补充“弱网下切网会复现”，请团队知道。',loop='频道普通消息不默认广播给全部 Agent；任务讨论可能唤醒 Agent assignee，入口很关键。',multica='顶层无提及评论可能唤醒 Agent 负责人；直接回复人类不走负责人兜底。可以 /note 保证只留言。',work='任务用户消息通常进入主专家回合。团队备注不能沿用同一默认执行语义。',gulf='“我只是说一句”与“机器开始工作”的执行鸿沟。',refs=['L_channels','M_mentioning-agents','W_session']),
 dict(name='@一个 Agent',intent='我希望修复助手处理这段复现信息。',loop='需实际身份候选、可见与调用授权；可查看投递诊断。',multica='触发该 Agent 运行；不自动更换负责人和状态，纯文本名字不算提及。',work='选择/召唤专家属于个人执行配置，不能直接等同多人评论派工。',gulf='“看见名字”不等于“有权调用”；“唤醒”不等于“担责”。',refs=['L_working','M_mentioning-agents','W_experts']),
 dict(name='交给一个团队',intent='让修复与测试协同完成，避免每个人都重复开工。',loop='Agent Team 只有 Agent，且创建者私有；成员需出现在频道，按 leader 与成员偏好运行。',multica='Squad 可含人和 Agent；指派小队先启动 Agent leader，具体成员通过真实提及参与。',work='专家团是主专家与成员组合；成员邀请、工作分派与独立验收尚未成为已核验团队闭环。',gulf='“一组执行者”与“多人有权有责的组织”之间的鸿沟。',refs=['L_teams','M_squads','W_experts']),
 dict(name='点赞或标记结论',intent='我认可这条回复，但不一定批准发布。',loop='reaction 附属于消息，不是新消息；不能从表情推断完成验收。',multica='reaction 不唤醒 Agent、不改事项状态；解决讨论和选结论是另一动作。',work='赞/踩是回答反馈，已点赞重复点击不重复上报；不是多人评审投票。',gulf='“表示认可”“结束讨论”“业务验收”三个反馈层次。',refs=['L_channels','M_comments','W_feedback-code']),
 dict(name='停止或回退',intent='我想撤销刚才的指令，避免继续改错。',loop='普通发送不打断；加急才打断；Rewind 有他人消息/分支等约束，不保证外部副作用回滚。',multica='可停止运行，已产生的文件变化仍需单独处理；按工具能力决定插话是否不中断。',work='停止、排队与回退到用户消息有不同路径；文件/外部系统的完整回滚未获证明。',gulf='对话时间线与真实世界副作用之间的鸿沟。',refs=['L_rewind','M_tasks','W_message-code']),
 dict(name='认定工作完成',intent='确认缺陷消失，再向团队宣布完成。',loop='Browser 使用 In Review 与讨论/活动，没有一等 Review Request；Workflow Approval 是另一机制。',multica='Run completed 不等于 issue done；按工作流交人或由有权者更新状态。',work='本轮收尾需最终回复和引擎空闲；多人业务验收记录是新增建议。',gulf='机器停止、产物生成与业务目标实现之间的评价鸿沟。',refs=['L_working','M_tasks','W_session'])]
modelhtml='<section class="chapter" id="product-models"><div class="chapter-head"><h2>三种用户心智：同一目标，不同工作入口</h2><p class="lead">以下心智模型是依据功能与交互归纳的产品分析，不是用户访谈结论。点击产品切换，再选择动作，观察同一句话的不同后果。</p></div><div class="tabs" id="model-tabs">'+''.join(f'<button class="btn" data-model="{i}" aria-pressed="{str(i==0).lower()}">{p}</button>' for i,p in enumerate(PRODUCTS))+'</div><div id="mental-model-display"></div><h3>同一动作，在三个产品里的后果</h3><div class="tabs" id="scenario-tabs">'+''.join(f'<button class="btn" data-scenario="{i}">{s["name"]}</button>' for i,s in enumerate(SCENARIOS))+'</div><div id="scenario-display" aria-live="polite"></div><h3>不同角色期待什么反馈</h3>'+table(['角色','Loop','Multica','MobileWork 当前 / 建议'],[['王蕾 · 产品','讨论是否收束，任务是否 In Review，主线有何公告','事项谁负责，哪轮失败，何时能验收','当前看个人任务与成果；建议增加团队工作项、待决策与证据验收'],['周启明 · 开发','Agent 收到了什么上下文，是否因加急打断','哪个 Agent / Run 在改代码，工作流是否交回','当前控制专家、工具、文件；建议个人工具链接入受控团队执行'],['陈晓 · QA','看同一产物和任务讨论，再反馈测试结果','评论批注具体差异，选择结论或发起返工','当前可在个人任务跑测试；建议 QA 独立权限与不可变测试证据']])+'</section>'
modeljs='''const MODELS=__MODELS__,SCENARIOS=__SCENARIOS__,MODELIMAGES=__MODELIMAGES__;function changeModel(i){document.querySelectorAll('[data-model]').forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));const m=MODELS[i];document.querySelector('#mental-model-display').innerHTML=`<div class="diagram" style="overflow:auto"><img style="display:block;width:100%;min-width:740px" src="${MODELIMAGES[i]}" alt="${m[0]} 用户心智模型"></div><p><a href="图源/${m[0]}-用户心智.svg">单独查看 / 保存 SVG</a></p>`;}function changeScenario(i){const s=SCENARIOS[i];document.querySelectorAll('[data-scenario]').forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));document.querySelector('#scenario-display').innerHTML=`<div class="callout"><b>用户意图：</b>${s.intent}</div><div class="tablewrap"><table><thead><tr><th>平凯 Loop</th><th>Multica</th><th>MobileWork</th></tr></thead><tbody><tr><td>${s.loop}</td><td>${s.multica}</td><td>${s.work}</td></tr></tbody></table></div><p><b>容易误解：</b>${s.gulf}</p><p>${s.refs.map(k=>`<a class="cite" href="证据索引.html#${k}">[${k}]</a>`).join(' ')}</p>`;}document.querySelectorAll('[data-model]').forEach(b=>b.onclick=()=>changeModel(+b.dataset.model));document.querySelectorAll('[data-scenario]').forEach(b=>b.onclick=()=>changeScenario(+b.dataset.scenario));changeModel(0);changeScenario(0);'''.replace('__MODELS__',json.dumps(MENTALS,ensure_ascii=False)).replace('__SCENARIOS__',json.dumps(SCENARIOS,ensure_ascii=False)).replace('__MODELIMAGES__',json.dumps(['data:image/svg+xml;base64,'+base64.b64encode((O/'图源'/f'{p}-用户心智.svg').read_bytes()).decode() for p in PRODUCTS]))
p=O/NAV[1];s=p.read_text();s=s.replace('</head>','<style>.scroll{overflow:auto;max-width:100%;border:1px solid #e3e1da;border-radius:10px}.current{min-width:0}.menu{flex-shrink:0}.tabs{display:flex;flex-wrap:wrap;gap:8px;margin:15px 0}.tablewrap{overflow:auto}#product-models table{min-width:760px}#product-models td{vertical-align:top}#mental-model-display{max-width:100%;overflow:hidden}</style></head>');s=s.replace("html+=chapter('story'","sections.push(['product-models','三种心智与动作对照']);html+="+json.dumps(modelhtml,ensure_ascii=False)+";\nhtml+=chapter('story'",1);s=s.replace("$('#main').innerHTML=html;","$('#main').innerHTML=html;")
# 插到模板脚本之后，此时动态 main 已建立。
s=s.replace('</body>','<script>'+modeljs+'</script></body>');s=s.replace('<header class="top">','<a style="position:fixed;bottom:14px;right:16px;z-index:20;background:white;padding:8px 14px;border:1px solid #ddd;border-radius:8px" href="index.html">返回四类文档</a><header class="top">');p.write_text(s)
md2=['# 用户心智模型及对比','\n所有人物与结果是贯穿示例，非运行实录。图和步进演示见同名 HTML。','\n## 三种核心心智']
for p,tt,ss in MENTALS:md2+=['\n### '+p,' → '.join(tt),f'\n![用户心智](图源/{p}-用户心智.svg)']
md2+=['\n## 动作与预期差异']
for x in SCENARIOS:
 md2+=['\n### '+x['name'],'用户意图：'+x['intent'],'\n- Loop：'+x['loop'],'- Multica：'+x['multica'],'- MobileWork：'+x['work'],'\n容易误解：'+x['gulf'],'\n来源：'+'、'.join(f'[{k}](证据索引.html#{k})' for k in x['refs'])]
md2+=['\n## 同一缺陷的完整旅程']
for x in d['steps']:md2+=['\n### '+x['title'],'操作者：'+x['actor'],'用户看到：'+x['visible'],'系统发生：'+x['system'],'记录：'+'；'.join(x['changes'])]
md2+=['\n## 关键判断']+['- '+x for x in d['takeaways']]
md('02-用户心智模型及对比.md','\n'.join(md2))
# 03：离线 SVG 时序与可编辑 Mermaid 同源，箭头次序只表示逻辑先后，不推断耗时。
SEQS=[]
def seq(key,title,lanes,events,refs,lead):
 v=dict(key=key,title=title,lanes=lanes,events=events,refs=refs,lead=lead);SEQS.append(v);return v
seq('loop-end-to-end','Loop：从频道协作到任务评审', ['王蕾 / 管理员','Loop 页面','频道 / Task','消息路由','Agent / Machine','周启明 / 陈晓'],[
(0,1,'准备工作区并邀请开发、测试','成员接受邀请；角色与频道成员分别校验'),
(1,2,'创建或加入问题频道','普通频道默认 private；未加入不能看消息'),
(0,1,'配置修复与测试 Agent，授权共享','Agent 公开与频道公开分别设置；Machine/runtime 需可用'),
(0,2,'频道提出弱网缺陷，进入回复话题','复现、预期、实际在局部话题澄清'),
(5,2,'补充开发约束与回归条件','讨论与业务责任先明确，避免让所有 Agent 抢答'),
(0,2,'由话题建任务并设置负责人','任务归单频道，保存来源 refs；指派与状态独立'),
(0,3,'真实提及修复 Agent，明确请求执行','精确启动方式遵循当前任务/话题与权限规则'),
(3,4,'按协作面、共享与投递规则唤醒','普通频道消息不默认广播给所有 Agent'),
(4,2,'回写执行活动与补丁 v1','可观察工具与运行时输入；R1 为示例编号'),
(5,2,'陈晓回归：预期 1，实际 2','示例失败；把具体差异写到任务讨论'),
(2,3,'任务讨论唤醒 Agent assignee','若 Agent 为 assignee；显式提及可增加接收目标'),
(3,4,'返工分支：请求第二次修复','运行中普通消息等待后续读取；加急才打断'),
(4,2,'回写补丁 v2 与第二次执行进展','不承诺聊天 Rewind 会回滚文件'),
(5,2,'陈晓再次回归：预期 1，实际 1','示例通过；保留对应 v2 的测试证据'),
(0,2,'王蕾在 In Review 检查并记录通过','Browser 用状态、讨论、活动；不是一等 Review Request'),
(0,2,'确认完成并显式发布任务公告','公告可按里程碑、评审、产物、总结等类别回到来源'),
(2,1,'通知相关成员并在收件箱查阅','按 Watcher/assignee 等策略；排除本次作者'),
(0,1,'整理话题、未读与任务记录','空间级归档是管理操作，不能等价于单个任务删除')],['L_members','L_channels','L_working','L_operate','L_rewind','L_teams'], '适合从团队对话逐步收束工作。任务状态、Agent 活动和 Workflow Approval 分别判断；下列测试结果是示例。')
seq('multica-end-to-end','Multica：持续事项跨越多次运行', ['王蕾 / 管理员','Multica 页面','Project / Issue','分派与调度','Agent / Runtime','周启明 / 陈晓'],[
(0,1,'准备工作区并邀请成员','受邀成员接受；至少保留一名 owner'),
(0,1,'连接 runtime，创建 Agent 并配置 Access','Agent 调用权限与 runtime 共享分别授权'),
(0,2,'建项目、说明与代码资源','项目可设工作流；本地共享目录串行或 worktree 并行'),
(0,2,'创建缺陷事项 W17，填写复现与标准','issue 是持续工作身份，和后续 run 分开'),
(5,2,'评论澄清，必要时选区批注','引用保留快照，发送前可预览触发目标'),
(0,3,'指派 Agent / Squad，选择开始方式','暂不开始仅保存；backlog 不执行；指派 Squad 先唤醒 leader'),
(3,4,'创建 R1，绑定原 runtime 排队与领取','queued / dispatched / 等目录 / running 逐层推进'),
(4,2,'回写日志、补丁 v1 和运行结果','run completed 不自动表示 issue done'),
(4,2,'按工作流动作更新事项或交回人评审','run 结束本身不自动改业务状态；需执行者更新'),
(5,2,'陈晓批注失败点，记录预期与实际','可将某条回复设结论；reply 会重开已解决讨论'),
(5,3,'返工分支：按失败目标重新交接','工作流是项目状态路由；切换默认可确认取消前一 Agent 运行'),
(3,4,'创建后续 R2，保留 W17 身份','不同运行记录不覆盖前一轮证据'),
(4,2,'交回补丁 v2 与测试输出','正文附件/评论产物与输入描述附件用途区分'),
(5,2,'复测通过，关联 v2 并记录结论','同一讨论只保留一个选定结论'),
(0,2,'王蕾确认业务通过并推进 done','或由符合规则的集成更新；不能用运行结束替代'),
(2,1,'事项订阅者收通知并标读/归档','直接提及仍通知取消订阅者；自己操作不自通知'),
(0,1,'看项目进度与 Agent 运行费用','done/closed 比例不是项目状态自动完成；费用是估算'),
(0,1,'整理视图与历史','事项保留证据，项目删除只解除关联，不删除事项')],['M_members-roles','M_agents','M_daemon-runtimes','M_projects','M_project-resources','M_comments','M_assigning-issues','M_tasks','M_workflows','M_inbox','M_analytics'], '适合把缺陷当作有持续身份的工作。工作流负责交接规则；事项、负责人、运行、项目状态各有生命周期。')
seq('work-end-to-end','MobileWork：个人任务到可检查成果', ['王蕾 / 当前用户','MobileWork 页面','Workspace / Session','本地引擎','主专家 / 工具','外部开发 / 测试'],[
(0,1,'登录并准备本地或远程空间','默认空间是目录/连接；不是团队成员容器'),
(0,1,'选择主专家、技能、模型与工具','专家全局资产；连接器已连不等于本会话授权'),
(0,2,'首次发送弱网缺陷需求与附件','新 session / 任务目录此时创建；不是共享 issue'),
(2,3,'提交本轮上下文与执行配置','发送时确定模型；当前回合不因后续设置而变化'),
(3,4,'主专家调用子代理、文件或浏览器','专家团属于执行组合；不是多成员组织'),
(4,1,'工具高风险操作请求用户确认','HITL 是工具授权；不是批准修复结果'),
(0,3,'允许本次操作或调整执行','黑名单不因完全访问就被豁免'),
(4,2,'输出补丁 v1、工具记录与文件成果','成果注册并可预览；远端文件复制与本地注册分开'),
(3,1,'最终回复且引擎空闲后收尾','待权限应答仍算进行中；不能只看最后一段正文'),
(0,5,'人工衔接：把 v1 交给陈晓回归','当前原生团队指派、评论与独立验收闭环未核验'),
(5,0,'人工反馈：弱网仍重复，要求返工','不是已证明存在的产品内通知或共享评论'),
(0,2,'在当前任务追问并附测试差异','消息通常再次进入主专家回合；排队在本轮真正结束后发送'),
(3,4,'执行第二轮并生成 v2','支持错误恢复与停止；不承诺撤销既有副作用'),
(4,2,'交付 v2 与新的执行记录','消息、子代理、文件可在个人任务中查看'),
(0,5,'人工衔接：请陈晓复测 v2','多人项目工作流属于文档 04 的建议'),
(5,0,'人工返回测试通过证据','示例预期 1、实际 1'),
(0,1,'用户判断成果可用并整理任务','当前未核验一等多人业务验收对象'),
(0,2,'后续查历史、文件或删除任务','删除任务不等于删除磁盘成果；知识中心当前强制隐藏')],['W_auth','W_workspace','W_experts','W_session','W_connectors','W_hitl-permission','W_files-artifacts','W_flags-code'], '当前以个人桌面任务为中心。图中明确写“人工衔接”的步骤是场景所需的人际协作，不宣称软件已原生支持。')
seq('loop-reply','Loop 微时序：回复、提及与加急', ['成员','会话 / Task','投递判断','Agent','通知'],[
(0,1,'从频道消息进入回复话题','话题承接局部上下文'),
(0,1,'提交普通消息','普通频道消息不默认群发所有 Agent'),
(1,2,'若是任务讨论，检查 assignee 与显式提及','任务讨论唤醒 Agent assignee；提及增加接收者'),
(2,3,'按共享、权限、成员偏好决定投递','Agent Team 按 leader/成员唤醒设置，不假定全员并行'),
(2,4,'按人类订阅与通知策略提示','通知与执行不是同一个动作'),
(0,1,'运行中补充说明','普通发送不打断当前任务'),
(0,1,'需要立刻转向时，对已发消息加急','不是再发一条普通消息；会打断并重递交同一可见消息'),
(1,3,'Agent 处理紧急输入并继续','停止已发生的文件/外部副作用仍需另行处理')],['L_channels','L_working','L_teams'], '重点：普通消息、任务讨论、真实提及、加急分别有不同执行含义。')
seq('multica-reply','Multica 微时序：一条评论触发谁', ['评论作者','评论 / Thread','触发预览与路由','Agent / Run','成员收件箱'],[
(0,1,'写回复、批注或顶层评论','批注引用内的提及不触发；自己填写的真实提及才算'),
(1,2,'预览目标、来源、权限与当前状态','显式提及优先；无提及才考虑兜底'),
(2,3,'回复 Agent → 它；已有 Agent 讨论 → 它','直接回复人类不走负责人兜底；顶层才可能走 Agent owner'),
(2,4,'按订阅或直接提及通知人','@all 只通知人并抑制负责人兜底；Agent 没有人类收件箱'),
(0,2,'选择 /note 或取消触发','只保存意见，不要求执行'),
(2,3,'同事项同 Agent 待运行合并，不同 Agent 分开','支持的 runtime 文本 steer 在当前步骤后读取'),
(3,1,'回写执行与已读取回执','带附件或不支持 steer 的场景走后续运行'),
(0,1,'标记解决或选一个结论；后续回复重开','reaction 不触发执行、不改业务状态')],['M_comments','M_mentioning-agents','M_inbox','M_tasks'], '重点：评论内容、通知、执行、讨论解决是四套相互关联但不等价的机制。')
seq('work-reply','MobileWork 微时序：追问、排队与权限', ['用户','任务输入区','Session / 引擎','主专家 / 子代理','工具 / 文件'],[
(0,1,'写追问并选择当前模型/专家/工具','当前任务是执行会话，不是共享评论讨论'),
(1,2,'空闲则发送；忙碌则进入待发队列','队列在内存按任务保存，不是持久 run 调度台账'),
(2,3,'执行当前回合','后续设置不改变当前回合'),
(3,0,'需人工授权时显示待确认','主/子会话显示来源；等待应答仍算忙'),
(0,4,'授权后才允许实际操作','安全许可与业务验收分开'),
(3,2,'提交最终结果且引擎空闲','才允许本轮真正结束并继续队列'),
(2,3,'下一条发出时读取当时的模型配置','排队时间的配置不一定就是执行时配置'),
(0,1,'停止、回退或继续处理失败','有限停止确认；不承诺外部副作用回滚')],['W_session','W_hitl-permission','W_message-code','W_experts'], '重点：个人任务消息天然承载执行意图，多人意见应新增独立评论通道。')

def svg_sequence(v):
 lanes=v['lanes'];events=v['events'];n=len(lanes);space=208;width=n*space+70;height=155+len(events)*90
 out=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" style="font-family:PingFang SC,Microsoft YaHei,sans-serif"><rect width="100%" height="100%" fill="#fff"/><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#2563c9"/></marker></defs>',f'<text x="22" y="28" font-size="18" font-weight="600">{E(v["title"])}</text>']
 for i,l in enumerate(lanes):
  x=65+i*space
  out.append(f'<rect x="{x-48}" y="45" width="185" height="42" rx="7" fill="#f1edfc" stroke="#d6cfee"/><text x="{x+44}" y="72" font-size="14" text-anchor="middle">{E(l)}</text><path d="M{x+44} 88 V{height-25}" stroke="#c6cbd1" stroke-dasharray="5 5"/>')
 for i,(a,b,label,note) in enumerate(events):
  y=125+i*90;xa=109+a*space;xb=109+b*space;mid=(xa+xb)/2
  # 行号与浅色带确保长图可追踪；文本保持横向可读。
  out.append(f'<g class="event" data-event="{i}"><rect x="5" y="{y-28}" width="{width-10}" height="79" rx="5" fill="{("#f6f8fb" if i%2==0 else "#fff")}" fill-opacity=".5"/><text x="14" y="{y+4}" font-size="12" fill="#727c87">{i+1:02}</text>')
  if a==b:
   out.append(f'<path d="M{xa} {y} h80 v18 h-80" fill="none" stroke="#2563c9" marker-end="url(#arrow)"/>');mid=xa+90
  else:out.append(f'<path d="M{xa} {y} H{xb}" fill="none" stroke="#2563c9" stroke-width="1.8" marker-end="url(#arrow)"/>')
  # 注释放在整行下部，避免短跨距容不下说明。
  txtx=width/2
  out.append(f'<rect x="{txtx-len(label)*7.0}" y="{y-25}" width="{len(label)*14.0+8}" height="21" fill="white"/><text x="{txtx}" y="{y-9}" text-anchor="middle" font-size="14" fill="#1c2330">{E(label)}</text><text x="{txtx}" y="{y+33}" text-anchor="middle" font-size="12" fill="#626a73">{E(note)}</text><circle cx="{xa}" cy="{y}" r="3" fill="#6b55c9"/></g>')
 return ''.join(out)+'</svg>'
def export_seq(v):
 (O/'图源'/(v['key']+'.svg')).write_text(svg_sequence(v))
 mm=['sequenceDiagram','    autonumber']+[f'    participant p{i} as {l}' for i,l in enumerate(v['lanes'])]
 for a,b,t,n in v['events']:
  mm +=[f'    p{a}->>p{b}: {t}',f'    Note over p{min(a,b)},p{max(a,b)}: {n}']
 (O/'图源'/(v['key']+'.mmd')).write_text('\n'.join(mm))
def seq_html(v):
 return f'<section id="{v["key"]}" class="seqblock"><h2>{E(v["title"])}</h2><p>{E(v["lead"])}</p><div class="toolbar"><button data-seq="prev">上一步</button><button data-seq="next">下一步</button><button data-seq="play">播放</button><button data-seq="reset">全览 / 重置</button><a href="图源/{v["key"]}.svg">独立 SVG</a><a href="图源/{v["key"]}.mmd">Mermaid 源图</a></div><div class="seq-note" role="status">全览：点击“下一步”逐步查看；纵向为逻辑先后，不代表耗时。</div><div class="scroll seq">{svg_sequence(v)}</div><p>'+''.join(cite(k) for k in v['refs'])+'</p></section>'
SEQJS='''document.querySelectorAll('.seqblock').forEach(block=>{let i=-1,timer=null;const events=[...block.querySelectorAll('.event')],note=block.querySelector('.seq-note'),buttons=block.querySelectorAll('[data-seq]');function stop(){if(timer)clearInterval(timer);timer=null;block.querySelector('[data-seq=play]').textContent='播放'}function render(){events.forEach((g,j)=>{g.classList.toggle('dim',i>=0&&j!==i);g.classList.toggle('hot',j===i)});note.textContent=i<0?'全览：纵向为逻辑先后，不代表耗时。':`${i+1} / ${events.length} · ${events[i].textContent}`;block.querySelector('[data-seq=prev]').disabled=i<0;block.querySelector('[data-seq=next]').disabled=i===events.length-1}buttons.forEach(b=>b.onclick=()=>{const a=b.dataset.seq;if(a==='play'){if(timer){stop();return}if(i===events.length-1)i=-1;b.textContent='暂停';timer=setInterval(()=>{i++;render();if(i>=events.length-1)stop()},1300)}else{stop();if(a==='prev')i=Math.max(-1,i-1);if(a==='next')i=Math.min(events.length-1,i+1);if(a==='reset')i=-1;render()}});render()});'''
for v in SEQS:export_seq(v)
body='<p class="lead">用同一个缺陷修复案例，比较准备、讨论、派工、执行、返工、验收与整理。所有补丁与测试结果都是场景示例；软件机制来自旁边的证据。</p><div class="pillrow">'+''.join(f'<a href="#{v["key"]}">{E(v["title"])}</a>' for v in SEQS)+'</div>'
body+='<h2>先比较交接点，再看完整时序</h2>'+table(['交接阶段']+PRODUCTS,[['需求进入','频道 / 回复话题','项目中的事项或独立事项','个人任务首次发送'],['开始执行','按提及、共享和任务讨论规则','指派 / 提及 / 交接，受状态与 Access 约束','用户发送给主专家'],['执行中的补充','普通消息后续读取；加急打断','支持时文字 steer；其他方式新运行或停后重启','待发队列；人工介入优先'],['失败后保留什么','任务讨论、进展与后续活动','同一 issue 下多次 run 与评论','同一 session 的多回合、错误和文件'],['跨人交接','任务与频道成员、状态及通知','事项负责人、工作流目标与订阅','本次未核验原生共享事项交接；图中显式人工衔接'],['完成依据','Browser In Review + 讨论/活动，人工判断','业务状态与运行状态分别处理','用户判断个人成果；多人验收对象待建设'],['定时与流程','定时跟进消息 / 条件开放的图工作流','Autopilot / 项目状态工作流','本地个人定时自动化']])
body+='<div class="callout boundary">本报告不比较响应时间或吞吐量：没有可比生产环境实测。时序图箭头表达产品语义与逻辑先后，不保证每个 UI 事件都对应一次网络请求。Agent 的具体代码与测试能力取决于所接工具。</div>'
body+=''.join(seq_html(v) for v in SEQS)
write(NAV[2],'整体使用时序：从讨论到执行、返工与验收',body,SEQJS)
md3=['# 整体使用时序图及对比','\n同一弱网缺陷案例，结果为示例。时序为产品逻辑，不是网络抓包，不代表耗时。']
for v in SEQS:
 md3+=['\n## '+v['title'],v['lead'],f'\n![时序图](图源/{v["key"]}.svg)',f'\n[可编辑 Mermaid](图源/{v["key"]}.mmd)','\n| 步骤 | 发送者 → 接收者 | 动作 | 边界 |','|---|---|---|---|']
 for i,(a,b,t,n) in enumerate(v['events']):md3.append(f'| {i+1} | {v["lanes"][a]} → {v["lanes"][b]} | {t} | {n} |')
 md3+=['\n来源：'+'、'.join(f'[{k}](证据索引.html#{k})' for k in v['refs'])]
md('03-整体使用时序图及对比.md','\n'.join(md3))
# 04：建议单独成文，不能混入现状矩阵。
PROPOSAL_MODULES=OrderedDict([
('团队空间与身份',['组织/团队空间与本地工作空间分离','邀请、接受、撤销、移除与离职交接','owner/admin/member 与项目角色','私有项目成员校验；管理员不自动读私有内容','Agent 实例、所有者、调用 Access、机器授权分开']),
('共享工作主线',['项目目标、成员、资料与验收标准','工作项：标题、描述、优先级、日期、父子关系','一个人类责任人；执行 Agent 可另选','todo/in_progress/in_review/blocked/done/cancelled','状态、负责人、订阅、运行各自独立','团队讨论 / 事项评论；P1 再扩完整频道话题']),
('评论、回复与通知',['顶层评论与同根嵌套回复','文本、代码、链接、附件与编辑标记','作者编辑/删除；管理删除留审计','删根留占位与回复；实际清理遵循保留政策','默认只留言；请求执行需显式确认目标','@人通知；@Agent 提供执行预览','表情不启动；解决讨论不等于验收','订阅、直接提及、未读、失败通知去重','P1 选区批注、结论替换、评论转子项']),
('多 Agent 执行',['主协调 Agent + 有职责的修复/测试成员','P0 指定 runtime；不自动跨机器迁移','一次 Run 独立状态、上下文快照和触发来源','相同命令幂等；排队去重与状态原子校验','共享目录串行；独立目录/worktree 才并行','预算、轮数、超时、循环检测与暂停','人工优先停止；控制面取消与机器确认分开']),
('成果、回归与验收',['ArtifactVersion：不可变版本、摘要、来源 Run','TestEvidence：输入、预期、实际、环境、日志','ReviewRequest：指定版本与验收人','Decision：通过/返工/驳回，绑定证据版本','新版本不继承旧批准；要求重新评审','显式回主线：里程碑、阻塞、产物、验收']),
('个人能力复用',['专家/技能资产 → 授权后实例化团队 Agent','连接器定义复用，密钥按运行边界引用','桌面浏览器与手动接管','本地/远程文件成果与预览','现有 HITL、模型选择、错误恢复','个人记忆与私有会话默认不共享']),
('治理与运营',['操作审计、可解释投递与权限拒绝','工具许可与业务决策分开呈现','成员移除撤权、停止新派单、资产交接','模型与运行成本、预算配额、异常暂停','团队可观测台：工作、运行、产物、决策','隐私、保留/删除、导出与恢复策略'])])
sheight=150+sum(60+len(a)*33 for a in PROPOSAL_MODULES.values())
psvg=f'<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="{sheight}" viewBox="0 0 1120 {sheight}" style="font-family:PingFang SC,Microsoft YaHei,sans-serif"><rect width="100%" height="100%" fill="#f6f5f1"/><rect x="25" y="20" width="1065" height="58" rx="10" fill="#f1edfc" stroke="#6b55c9"/><text x="45" y="57" font-size="23" fill="#6b55c9">MobileWork 多人多智能体融合建议 · 全景功能树（尚未实现）</text>'
py=115
for k,arr in PROPOSAL_MODULES.items():
 cy=py+25
 psvg+=f'<path d="M70 78V{cy}H120" stroke="#6b55c9" fill="none"/><rect x="120" y="{py}" width="265" height="50" rx="8" fill="white" stroke="#2563c9"/><text x="138" y="{py+31}" font-size="17" fill="#2563c9">{E(k)}</text>'
 for j,t in enumerate(arr):
  yy=py+16+j*33
  psvg+=f'<path d="M385 {cy}H410V{yy+3}H430" stroke="#9bb9d2" fill="none"/><text x="440" y="{yy+8}" font-size="14" fill="#1c2330">{E(t)}</text>'
 py+=60+len(arr)*33
psvg+='</svg>'
(O/'图源/MobileWork-融合建议思维导图.svg').write_text(psvg)
proposal_tree='<details open><summary>MobileWork 融合建议 · 全景思维导图</summary>'+''.join('<details open><summary>'+E(k)+'</summary><ul>'+''.join('<li>'+E(x)+'</li>' for x in a)+'</ul></details>' for k,a in PROPOSAL_MODULES.items())+'</details>'
(O/'图源/MobileWork-融合建议思维导图.mmd').write_text('mindmap\n  root((MobileWork 多人多智能体 建议))\n'+'\n'.join('    '+k+'\n'+'\n'.join('      '+x for x in a) for k,a in PROPOSAL_MODULES.items()))
# 建议心智图复用同一闭环语法，但显式增设独立责任与证据批准。
pt=['团队有一个共同目标','项目中建立工作项 W17','人类负责，Agent 执行','Run 产出明确版本','独立 QA 留测试证据','王蕾对 v2 明确验收']
ps=['个人工作空间仍独立','讨论/责任/标准持续保留','调用权限与工具许可分开','R1/v1 与 R2/v2 可追溯','失败返工，证据不被覆盖','完成依赖指定版本与决策']
(O/'图源/MobileWork-融合建议用户心智.svg').write_text(mental_svg('MobileWork 融合建议',pt,ps))
# 架构图：人→协作控制→本地执行，工作账本在服务下；建议而非已实现。
arch='''<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="680" viewBox="0 0 1100 680" style="font-family:PingFang SC,Microsoft YaHei,sans-serif"><rect width="100%" height="100%" fill="#f6f5f1"/><defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#2563c9"/></marker></defs><rect x="20" y="50" width="240" height="595" rx="12" fill="#f1edfc"/><rect x="300" y="50" width="450" height="350" rx="12" fill="#eaf1fd"/><rect x="300" y="425" width="450" height="220" rx="12" fill="#e6f5f1"/><rect x="800" y="50" width="280" height="595" rx="12" fill="#fdf1e6"/><g font-size="16" font-weight="600"><text x="25" y="29">建议架构 · 协作账本独立于个人执行环境</text><text x="38" y="80">人与团队入口</text><text x="320" y="80">团队协调服务</text><text x="320" y="456">持续工作与证据记录</text><text x="820" y="80">用户授权的执行环境</text></g><g fill="none" stroke="#2563c9" stroke-width="2" marker-end="url(#a)"><path d="M235 170H325"/><path d="M525 210V255"/><path d="M725 290H770V160H820"/><path d="M940 205V260"/><path d="M820 315H775V360H725"/><path d="M525 330V480"/><path d="M325 565H280V325H235"/></g><g font-size="12" fill="#2563c9"><text x="265" y="155">意图</text><text x="540" y="238">校验后派工</text><text x="775" y="235">Run</text><text x="953" y="236">调用工具</text><text x="775" y="345">结果</text><text x="540" y="417">持久化</text><text x="265" y="447">读取证据</text></g>'''
for x,y,w,h,t,s,c in [(40,125,195,85,'团队工作台','项目 · 工作项 · 讨论','#6b55c9'),(40,285,195,85,'待我决策','工具许可 ≠ 业务验收','#6b55c9'),(325,125,400,85,'成员与可见性校验','调用 Access · 作用域 · 上下文版本','#2563c9'),(325,255,400,75,'派工与 Run 协调','幂等 · 目录锁 · 配额 · 取消','#2563c9'),(325,480,400,85,'工作 / 执行 / 产物 / 决策','稳定身份 · 不可变证据版本','#0d8a76'),(820,125,240,80,'Agent 实例 / Runtime','指定机器 · 人工授权','#d06a1c'),(820,260,240,85,'MobileWork 现有引擎','专家 · 技能 · 浏览器 · 文件','#c03a68'),(820,465,240,85,'本地权限与密钥','HITL · 最小上下文 · 不上传密钥','#d06a1c')]:
 arch+=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="white" stroke="{c}"/><text x="{x+15}" y="{y+31}" font-size="17" fill="{c}">{t}</text><text x="{x+15}" y="{y+59}" font-size="12" fill="#626a73">{s}</text>'
arch+='</svg>'; (O/'图源/MobileWork-融合建议架构.svg').write_text(arch)
# 两套建议时序，分别交付正常闭环与撤权/迟到结果边界。
vprop=seq('proposal-end-to-end','建议时序：多人负责、多 Agent 执行、证据验收',['王蕾 / 周启明','团队工作台','WorkItem / Decision','调度与权限','修复 / 测试 Agent','陈晓 / QA'],[
(0,1,'建团队项目 P17，邀请并授权成员','团队空间与个人目录分离；项目私有默认最小可见'),
(0,2,'创建 W17，写复现与验收条件','humanOwner=周启明，reviewer=王蕾，QA=陈晓'),
(0,1,'留言澄清；显式选择“请求执行”','评论默认不启动；预览接收者、调用权限、运行模式与预算'),
(1,3,'提交带幂等键与预期版本的派工命令','重复点击同命令只返回同一记录；并发状态冲突要求确认'),
(3,2,'创建 R1 并保存输入上下文快照','记录来源评论、权限版本、资产版本和目录锁'),
(3,4,'指定 runtime 执行 R1','本机高风险操作仍走工具授权；离线不自动迁移机器'),
(4,2,'登记不可变 ArtifactVersion v1','文件摘要/仓库提交、来源 R1、可访问位置明确'),
(3,4,'按 QA 授权和指定目录发起测试','修复 Agent 不能自己替人类批准；共享目录不可无锁并跑'),
(4,2,'登记 TestEvidence QA1：预期 1，实际 2','示例失败；测试日志与 v1 绑定'),
(5,2,'陈晓提交返工决定，说明失败点','生成新决策记录；不删除 R1/QA1'),
(0,3,'周启明确认下一轮请求 R2','预算与循环上限重新检查；超额先暂停'),
(4,2,'R2 → v2；测试生成 QA2 通过','同一 W17 新执行与新证据，旧证据不可被覆盖'),
(0,2,'提交 ReviewRequest：指定 v2 + QA2','只有有权评审者可批准，检查最新版本和证据完整性'),
(0,2,'王蕾明确验收通过','Decision 引用 W17版本、v2摘要和 QA2；过期证据拒绝批准'),
(2,1,'将 W17 标 done 并发布主线摘要','决策、状态、通知采用可靠事件处理；P0 无自动发布外部系统'),
(1,5,'通知项目成员并支持定位到证据','不向无权者泄露产物或私有执行日志')],[], '以下全部为产品与技术建议。R1 失败、R2 通过是贯穿示例，尚非现有功能。')
vfail=seq('proposal-revoke','建议时序：离线、撤权与迟到结果',['空间管理员','工作项服务','调度器','运行机器','审批人'],[
(0,1,'移除成员或撤销 Agent/runtime 调用权','撤销后立刻禁止新派单；历史保留与资产交接按策略'),
(1,2,'标记受影响运行 cancel_requested','记录撤权原因和权限版本，不伪装机器已停止'),
(2,3,'发送取消请求；若离线则显示未确认','机器可能已在执行，控制面不能保证立刻杀掉'),
(3,2,'机器重连，回报真实退出与已做操作','可确认 cancelled；已写文件仍需人工评估补偿'),
(3,1,'迟到结果附原 Run 与产物版本回交','保存为历史证据，不自动覆盖更新的工作状态'),
(4,1,'尝试批准旧版 v1','若当前待审是 v2 或权限已撤销，拒绝并显示原因'),
(1,4,'展示差异、版本与受影响证据','用户显式提交新请求；旧批准不继承'),
(0,1,'决定是否迁移机器或恢复执行','P0 由人选新机器、重新授权并创建新 Run，不隐式续跑')],[], '建议把“请求取消”和“确认停止”分开；过期结果可追溯，但不能越过新权限或新版本。')
for v in [vprop,vfail]:export_seq(v)
OBJECTS=[
('TeamWorkspace','id、组织名、成员、保留策略','有 1:N Project；与 LocalWorkspace 无等号关系'),
('Project','id、目标、visibility、成员、资料版本','有 1:N WorkItem；有显式团队参与范围'),
('WorkItem','id、projectId、humanOwner、executorRef、status、priority、version、acceptanceCriteria','人类责任始终明确；1:N Run / Thread / ReviewRequest'),
('Comment / Thread','id、rootId、replyToId、author、body、editedAt、deletedAt、version、attachments','同根回复；消息可见性继承工作项；编辑不偷偷重跑'),
('AgentInstance','id、assetVersion、owner、accessPolicy、runtimeBinding、capabilities','专家资产可复用；实例调用权限和机器授权分离'),
('DispatchCommand / Run','idempotencyKey、expectedVersion；runId、triggerRef、agentId、runtimeId、inputSnapshot、status、cost','命令去重；一次 Run 一份执行记录；用户消息队列不充当台账'),
('ArtifactVersion','artifactId、versionId、hash/commit、sourceRunId、storageRef、visibility','内容和来源不可变；改动创建新版本，不覆盖旧批准'),
('TestEvidence','id、artifactVersion、caseVersion、environment、expected、actual、result、logRef','包含通过/失败与实际验证范围；不因一句“已测”生成通过'),
('ReviewRequest / Decision','reviewer、workItemVersion、artifactVersions、testEvidenceIds；actor、result、reason、timestamp','决策不可改写；通过只对指定证据有效，新版本需重新批准'),
('Subscription / AuditEvent','对象、用户、通知偏好；actor、action、targetVersion、result','直接提及单独处理；关注、已读与 Agent 执行分开')]
COMMENT_RULES=[
('发送文本/附件','默认“仅留言”；草稿与失败重试保留','提交前展示可见范围；附件单独检查权限与配额'),
('回复某人','保存 rootId 与 replyToId；仍留在同一顶层讨论','不会因回复 Agent 就默认执行；主动点击“请求执行”'),
('提及人','使用真实身份候选，触发通知','不改变负责人、状态或执行者；避免作者自通知'),
('提及 Agent / 小队','选择后展示“仅提及 / 请求执行”与权限状态','执行才创建派工命令；P0 小队仅协调 Agent 可受控派成员'),
('编辑评论','作者可改，显示编辑标记并保留版本','不自动重跑旧请求；新增通知可预览，重跑需新命令'),
('删除评论','作者删除；管理员管理删除留原因与审计','根评论留占位，回复与已用执行快照按保留策略留存；不能删掉合法证据链'),
('重复/并发提交','客户端稳定命令键；服务端原子去重与版本校验','同一键不同内容拒绝；发现远端更新让用户选合并或重新提交'),
('表情回应','同一人同表情开/关，仅记录反应','不唤醒、不变负责人、不代替通过'),
('解决/重开讨论','标记讨论已解决；新回复可重开并提示','讨论解决与 WorkItem done、Decision approved 独立'),
('批注与结论 P1','选区快照、编号、草稿；同讨论一个选定结论','新结论替换需留历史；引用内提及不触发；限制容量以压测确定'),
('只留言/执行预览','明确本次通知人、Agent、权限、忙闲与预计资源','不能只用颜色表示；无权目标不可静默略过'),
('运行中补充','P0 仅“本轮后开始”或“停止后重新执行”','仅在引擎能证明送达时 P1 开放无中断插话，保留回执'),
('通知与订阅','项目/工作项订阅，直接提及，分配、失败和待验收去重','取消关注不取消直接提及；已读只影响人的注意力，不影响执行'),
('评论转子项 P1','选定评论及此前必要上下文生成来源快照','不自动带出无权内容；子项责任/权限单独确认，后续源更新提示而不覆盖')]
ROADMAP=[
('P0 · 跑通一条可信闭环','团队成员与最小权限；项目/工作项；评论/回复/真实提及；显式派工；指定 runtime；Run/目录锁；产物版本；QA证据；人工验收；通知审计','用弱网缺陷案例完成 R1 失败 → R2 通过；刷新/重连不丢责任与证据；越权与重复执行可阻止','使用已有专家/技能/工具引擎；不先做全功能聊天、不开放自治跨机器调度'),
('P1 · 降低跨人协作成本','线程批注与结论；状态交接模板；Agent 小队受控派工；可送达插话；可保存视图；显式频道回源；个人任务升格工作项','并发编辑、来源快照、权限撤销和人工接管均可解释；能完成两个独立项目试点','有稳定 P0 证据对象和授权接口之后扩展；每项单独确认接入工具能力'),
('P2 · 在约束内扩大自动化','可视化工作流；定时与事件触发；更多运行适配器；模板与运营分析；条件满足后目录隔离并行与人工确认机器迁移','预算、异常暂停、循环限制、恢复流程和历史兼容通过试点','避免直接复用旧定时任务作为多租户调度器；引入前先做迁移与兼容验证')]
AC=[
('重复派工','同一评论命令连续提交或网络重传','只产生一个 Run；同键不同内容拒绝，界面能定位原 Run'),
('明确责任','同时 @修复与测试，但负责人未改','人类责任人不被提及覆盖；执行者与责任人分别展示'),
('普通回复','陈晓在任务内只补一句测试条件','保存评论并通知有权成员；不创建 Run、不消耗执行预算'),
('并发状态更新','王蕾验收时周启明已提交 v3','旧 expectedVersion 或证据集不匹配，不能把 v2 批准扩展到 v3'),
('成员撤权','移除原本可执行的成员','新派单被拒；活动运行显示请求取消/未确认/已停止，结果保留审计'),
('目录竞争','两个 Agent 请求同时修改同一共享目录','后者等待或拒绝，不出现无锁双写；独立目录并行需明确隔离'),
('QA 不通过','v1 测试实际 2、预期 1','留下不可变失败证据，不能 done；返工生成后续 Run'),
('版本验收','v2 + QA2 通过后提交人工通过','只有指定有权评审者创建 Decision；Decision 可反查输入、版本、测试与执行'),
('机器离线','已入队任务绑定机器断联','显示等待/失败及原因；不暗中发到另一台机器；恢复有幂等与原版本检查'),
('停止与迟到结果','停止后机器迟到回报成功','不自动覆盖已停止或新工作状态；仍可查看已发生副作用与历史产物'),
('隐私','个人会话含私有记忆、密钥或无权附件','团队上下文仅装配被授权快照；密钥不入评论/提示词/共享日志'),
('刷新与恢复','P0 场景中途关闭客户端再进入','工作项、Run、产物、测试与决策由服务端持续恢复；内存消息队列不当作持久调度')]
body='<p class="lead">建议把 MobileWork 扩展为“人对结果负责、Agent 在授权环境中执行、团队按证据验收”的协作产品。保留个人桌面任务，在其上增加共享工作主线。</p>'+badge('建议')+'<p>本篇所有新增对象、默认规则、阶段和验收项都是建议，尚未实现。用户提供的团队原型与 v0.2 技术方案仅作为设计输入，原型 localStorage 演示不证明生产能力。</p>'+''.join(cite(k) for k in ['P_prototype','P_steps','P_proposal','P_design'])
body+='<section><h2>01 / 产品边界与借鉴取舍</h2>'+table(['产品输入','建议吸收','需要调整'],[['Loop','频道/话题保留协作上下文，任务进展显式回源，投递原因可解释','P0 先做工作项评论；不复制创建者私有 Agent Team 作为组织默认团队；公开频道不等于公开 Agent'],['Multica','稳定事项身份、独立 Run、Agent Access、触发预览与评论精细语义','采用显式派工默认，减少普通留言的意外执行；工作流状态交接与一般图引擎分期'],['MobileWork','专家、技能、连接器、浏览器手动接管、成果文件、HITL 与模型就绪提示','本地目录不当作团队空间；主/子会话不当作父/子业务事项；定时任务不直接升级成多人调度器']])+'<p>当前依据：'+''.join(cite(k) for k in ['L_channels','L_teams','M_tasks','M_mentioning-agents','M_agents','W_experts','W_automation','W_hitl-permission'])+'</p></section>'
body+='<section><h2>02 / 建议思维导图与信息架构</h2>'+proposal_tree+'<p><a href="图源/MobileWork-融合建议思维导图.svg">完整 SVG 思维导图</a> · <a href="图源/MobileWork-融合建议思维导图.mmd">可编辑 Mermaid 思维导图</a></p>'+table(['一级入口','主要对象与小功能','用户关注的问题'],[['我的工作','保留工作空间、个人任务、专家、技能、文件和自动化','我当前的环境里有哪些事在跑、成果在哪里'],['团队工作','项目列表 → 工作项 → 说明/讨论/运行/产物/验收标签','这件事归谁、谁在执行、下一步等谁'],['待我处理','待回复、待工具许可、待验收、阻塞，类型分开','我为什么被叫到、我的决定会影响什么'],['团队运行','Run 队列、绑定机器、失败、预算、权限拒绝','是谁启动、用了什么、为何没执行或还没停'],['团队设置','成员、邀请、资产调用授权、执行机器、保留策略、审计','谁有权看和做，退出后怎么交接']])+'</section>'
body+='<section><h2>03 / 建议用户心智：一件事，多个人，多次执行</h2><div class="diagram scroll"><img style="min-width:740px" src="图源/MobileWork-融合建议用户心智.svg" alt="建议用户心智"></div><p>对王蕾，系统应回答“问题是否已被证据证明修好”；对周启明，应回答“我负责什么、Agent 现在改哪一版”；对陈晓，应回答“我测了什么、结果绑定哪一版、失败交回谁”。三者都围绕 W17，而不是到处寻找散落的聊天。</p><div class="callout">一眼读懂工作卡片：W17「弱网重复待办」｜责任人 周启明｜执行 修复助手｜状态 待评审｜最新产物 v2｜QA2 通过｜待 王蕾验收。点击任一字段能反查来源，而不是只显示一个笼统“完成”。</div></section>'
body+='<section><h2>04 / 建议对象模型与模块关系</h2><div class="diagram scroll"><img style="min-width:850px" src="图源/MobileWork-融合建议架构.svg" alt="建议架构"></div>'+table(['对象','最小字段','关系与约束'],OBJECTS)+'<h3>两套状态机必须分离</h3>'+table(['层次','建议状态','转换规则'],[['WorkItem 业务层','todo → in_progress → in_review → done；blocked / cancelled 分支','开始由显式派工或人确认；提交评审要求版本与证据；返工回 in_progress；done 要求有效 Decision'],['Run 执行层','queued → dispatched → running → completed / failed / cancelled；cancel_requested 为中间事实','执行完成只更新 Run 与产物；不直接验收 WorkItem；取消请求需要执行端确认'],['ReviewRequest 决策层','pending → approved / rework / rejected / superseded','批准绑定证据版本；新版本令旧请求过期；不能把点赞/工具许可当批准']])+'</section>'
body+='<section><h2>05 / 评论与回复：默认意图必须可预测</h2><p>推荐默认“仅留言”。在输入区旁提供独立的“请求执行”，显示这次给谁、基于哪份上下文、是在本轮后执行还是停止后重启。用户能在发送前看到实际后果。</p>'+table(['微功能','建议规则','边界与错误处理'],COMMENT_RULES)+'</section>'
body+='<section><h2>06 / 权限、上下文与并行边界</h2>'+table(['边界','建议规则'],[['谁能看','项目成员资格 + 工作项可见性 + 附件访问共同约束；服务端校验，不靠隐藏按钮；管理员可治理但不自动阅读全部私有内容'],['谁能调用 Agent','Agent owner 决定调用 Access；项目有权不自动有 Agent 调用权；派工前校验模型、机器与预算'],['谁能批准','安全许可由机器/会话有权人做；业务通过由指定评审人做；Agent 可以给建议，P0 不替人类验收'],['哪些上下文共享','项目资料、工作项说明、选择的评论快照与授权文件引用；个人记忆、私聊、连接器密钥默认不共享'],['团队资产如何复用','把个人专家/技能以明确版本复制或引用为团队实例；作者发布和调用方授权分开，撤销后禁止新调用'],['如何并行','P0 同一可写目录串行；独立目录或 worktree 可并行，但共享浏览器、外部账号与发布资源仍需锁或人工协调'],['何时自动停止','预算、工具次数、总时长、委派深度、相互唤醒次数分别设上限；超限暂停并保留账本，默认阈值由试点校准'],['离线与恢复','控制面记录真实确认状态；取消不承诺立即远端终止；重连核对 runId、输入版本、权限版本与幂等键后回交'],['保留与删除','UI 软删除与证据快照保留分别定义；按组织策略期限与合法删除请求实际清理，不能永久保留一切'],['失败补偿','已发生外部写入按工具能力提示人工评估或补偿；不宣称统一事务或全副作用回滚']])+'</section>'
body+=seq_html(vprop)+seq_html(vfail)
body+='<section><h2>09 / 分期实施与进入下一阶段的门槛</h2>'+table(['阶段','内容','放行标准','取舍'],ROADMAP)+'<h3>实现路径：先验证适配契约，再决定复用深度</h3><p>建议团队协调服务新增持久工作账本，MobileWork 现有引擎通过适配层领取/回报 Run。现有 Session 作为执行载体，不能直接暴露成多人事项。旧自动化继续跑个人任务；团队定时触发通过同一派工命令进入新服务。</p><p>Multica 可作为机制参考或独立控制面的候选，但本次没有核验可嵌入 SDK、许可证适配、数据迁移和稳定外部接口覆盖。先用隔离测试项目验证：创建工作项 → 绑定指定 runtime → 回报产物 → 取消确认 → 权限撤销；验证后再决定独立集成、代码复用或自建。不要把已有 HTTP API 等同可替换 MobileWork 引擎。'+cite('M_api')+'</p><h3>现有本地原型应如何升级</h3><p>保留王蕾/周启明/陈晓、弱网问题、v1 失败与 v2 通过的贯穿演示。但把 localStorage 事件迁到服务端持久对象，补真实身份、权限、并发控制、版本化产物、机器回报与不可变决策。原型中的“点击完成”只能验收交互连贯性，不能验收真实多 Agent 调度。'+cite('P_prototype')+cite('P_steps')+'</p></section>'
body+='<section><h2>10 / 可验证的 P0 验收清单</h2>'+table(['场景','操作','应观察到的结果'],AC)+'<h3>试点指标：先建基线，再设目标</h3>'+table(['指标','口径','用于判断'],[['闭环完成率','有明确验收 Decision 的已完成工作项 ÷ 试点进入执行的工作项','团队是否真正交付，而非只增长消息数'],['错误执行率','用户申诉或取消为“本不想启动”的 Run ÷ 全部 Run','显式派工是否减少意图误判'],['首轮通过率 / 返工率','首次候选产物验收通过占比；按版本/原因统计返工','多 Agent 是否提高质量，避免以运行数代替效果'],['等待分解','从需求到派工、排队、执行、待人评审分别计时','瓶颈是人、机器还是上下文缺失'],['追溯完整率','done 中能反查标准、输入、Run、产物、QA、Decision 的比例','证据闭环是否可审查'],['单位验收成本','已批准工作项关联模型/运行成本及人工估计时间','效率收益是否覆盖执行与协调成本'],['权限与恢复指标','越权被拒/误拒、取消未确认时长、重复 Run、迟到覆盖次数','系统是否可靠、可解释；目标试点后设定']])+'<p>建议先选研发修复或运营文档交付中的一种场景试点，避免同时覆盖全部行业。上面没有虚构性能或收益基线；成本和时效目标应由真实试点数据确定。</p></section>'
write(NAV[3],'MobileWork 融合建议：共享责任、受控执行、证据验收',body,SEQJS)
# 对建议文档保留结构化可编辑稿；以 HTML 为完整阅读版本。
md4=['# MobileWork 多人多智能体融合建议','\n本篇为建议，尚未实现。保留个人桌面执行，新增独立团队工作账本。人物与弱网缺陷为示例。','\n## 产品判断','人对结果负责，Agent 在授权环境执行，团队按版本化证据验收。Loop 借鉴上下文与显式回源；Multica 借鉴事项/Run/Access；MobileWork 复用专家、技能、工具、浏览器、文件与 HITL。','\n## 建议思维导图']
for k,a in PROPOSAL_MODULES.items():md4+=['\n### '+k]+['- '+x for x in a]
md4+=['\n## 建议心智模型',' → '.join(pt),'\n![建议心智](图源/MobileWork-融合建议用户心智.svg)','\n![建议架构](图源/MobileWork-融合建议架构.svg)']
for heading,headers,rows in [('对象模型',['对象','字段','约束'],OBJECTS),('评论与回复规则',['微功能','建议','边界'],COMMENT_RULES),('分期实施',['阶段','内容','标准','取舍'],ROADMAP),('P0验收',['场景','操作','结果'],AC)]:
 md4+=['\n## '+heading,'\n| '+' | '.join(headers)+' |','|'+'---|'*len(headers)]
 md4+=['| '+' | '.join(str(c).replace('|','/').replace('\n',' ') for c in r)+' |' for r in rows]
for v in [vprop,vfail]:md4+=['\n## '+v['title'],v['lead'],f'\n![建议时序](图源/{v["key"]}.svg)',f'\n[可编辑 Mermaid](图源/{v["key"]}.mmd)']+['\n'+str(i+1)+'、'+v['lanes'][a]+' → '+v['lanes'][b]+'：'+t+'。'+n for i,(a,b,t,n) in enumerate(v['events'])]
md4+=['\n## 技术验证与度量','团队工作服务与个人执行引擎通过 Run 适配契约连接。先验证指定 runtime、取消确认、权限撤销、版本化结果回交，再决定自建或集成。现有 API 不证明具备可嵌入 SDK 或许可适配。','指标：闭环完成率、错误执行率、首轮通过率、分阶段等待、追溯完整率、单位验收成本、权限拒绝与恢复。目标与阈值由试点确定，不虚构基线。','\n完整权限/上下文/保留策略、IA 与原型升级说明见同名 HTML。']
md('04-MobileWork多人多智能体融合建议.md','\n'.join(md4))
(O/'时序数据.json').write_text(json.dumps(SEQS,ensure_ascii=False,indent=2))
# 证据与范围：给读者可核对的原文，不用“未找到”推导产品不存在。
body='<p class="lead">每个来源有稳定编号、获取范围、版本与本地快照。功能矩阵中的引文跳到本页，随后可直接打开原文。</p><p>Loop：官方站点公开文档快照，采集于 2026-11-08；不代表任意账号都已开通。Multica 与 MobileWork：本地 Git 版本见下表；源码可见不代表部署可用。代码节选保留原行号，完整文件 SHA-256 用于识别版本。</p>'+table(['产品','依据版本'],[[p,E(v)] for p,v in VERS.items()])+'<div class="callout boundary">来源中的命令、提示词和操作步骤均作为待分析资料；没有把它们当成用户要求执行，也未运行真实 Agent、发送协作消息或修改产品配置。</div>'
for k,s in REG.items():
 body+=f'<section id="{E(k)}"><h3>{E(k)} · {E(s["product"])}</h3>{badge(s["kind"])}<b>{E(s["label"])}</b><p><a href="{E(s["snapshot"])}">打开离线原文 / 代码节选</a>'+(f' · <a href="{E(s["url"])}" target="_blank" rel="noreferrer">官方原网页</a>' if s['url'] else '')+f'</p><p class="muted anchorlink">原路径：{E(s["absolute_path"])}<br>定位行：{s["line"]}；版本：{E(s["version"])}<br>源文件 SHA-256：{s["sha256"]}</p></section>'
write('证据索引.html','证据索引：来源、版本与离线快照',body)
# 所有 Loop 页面进入覆盖索引；本地 docs/invariants 按标题列出，明确不把目录扫描当逐行审计。
coverage=['<p class="lead">本报告覆盖 19 个模块、289 个原子对照项、三套功能树、三套用户心智图、六张现状时序与两张建议时序。覆盖定义是“本次资料范围内的功能与关系”，不等于对三产品全部线上版本做完整认证。</p>',
'<h2>研究口径</h2><ol><li>Loop：读取官方 32 篇文档全文，另外读取功能页和价格页；未使用教程预录回复证明真实执行成功。</li><li>Multica：读取相关产品文档，对评论路由、reaction、附件、设置和公开 API 等以代码交叉核对。未启动完整服务与真实 runtime。</li><li>MobileWork：读取当前 invariants 的有效部分，重点交叉检查导航、强制隐藏标志、消息动作、分享令牌、专家、自动化与浏览器源码。代码和约束冲突时在具体结论说明。</li><li>本地团队原型、22 页静态设计和团队技术方案作为示例/提案输入，与当前实现分开。</li><li>功能树和矩阵同源。树中的待核验分支只是对照位置；不用于功能计数排名。</li></ol>',
'<h2>必须保留的限制与资料冲突</h2>'+table(['位置','发现','本报告处理'],[
['Loop 工作流','官方详细文档可见，价格页仍写“工作流（敬请期待）”','条件能力；组织权益与版本待实际账号验证'],
['Loop 快速上手','首次预置回复与 HTML 是演示内容','不当作真实 Agent 已生成成果的证据'],
['MobileWork 导航','旧约束提及 AI 工作台等入口；当前 module-nav 与隐藏标志不同','按当前源码导航判断；知识中心强制隐藏'],
['MobileWork 反馈','门户“提交反馈”被隐藏，任务“一键上报”仍有入口','两类入口分开；不写“没有反馈”'],
['MobileWork 置顶/归档','置顶已在任务菜单接线；保留归档回调不代表菜单完整暴露','置顶记源码证据；归档用户闭环待实机核验'],
['三边“工作流”','Loop 是条件开放的图流程；Multica 是项目状态交接；Work 是本地自动化','各自定义，避免按同名打勾'],
['多人与多 Agent','执行子代理与组织成员权责不是同层','MobileWork 团队项目、评论、验收现状未核验，建议另建'],
['当前可用性','未登录三产品账号完成端到端测试','所有现状判断注明文档/源码/条件，建议不冒充实现']]),
'<h2>尚待产品账号或工程验证的问题</h2><ul><li>Loop：当前组织工作流权益、Agent Team 在实际频道中的唤醒偏好、独立 Project 实体边界、消息编辑/删除权限、任务日期/自定义状态、机器离线恢复细节。</li><li>Multica：当前工作区功能开关、移动端与桌面端具体差异、部署的上传限制、外部渠道通知回写、产品反馈与计费实际开通状态。</li><li>MobileWork：真实桌面版本的全部菜单接线、语音与浏览器平台条件、远程共享的实际部署流程、团队成员邀请到独立验收的生产闭环。</li><li>融合建议：稳定的 Run 适配接口、机器取消确认、权限撤销、目录锁、版本化证据、许可证与部署合规，均需在实施前用隔离试点验证。</li></ul>']
coverage+=['<h2>证据分布（仅表示本次核验程度）</h2>']
statrows=[]
for status in ['文档','源码','条件能力','未核验','入口隐藏']:
 statrows.append([status]+[sum(c['status']==status for f in FEATURES for j,c in enumerate(f['cells']) if j==i) for i in range(3)])
coverage.append(table(['主要证据标签']+PRODUCTS,statrows));coverage.append('<p>一个单元格可能同时包含已确认内容与局部未核验；表格以主要标签统计，不能转换为产品能力得分。</p>')
coverage.append('<h2>Loop 官方 32 篇文档目录</h2><p>下列为本次全文采集目录；部分页面说明同一功能的不同视角，不按篇数算功能。</p>')
coverage.append(table(['页面','官方链接','离线快照'],[[E(next((l.strip() for l in d['text'].splitlines() if l.strip() and l.strip()!='ZH'),d['url'])),f'<a class="anchorlink" href="{E(d["url"])}">{E(d["url"])}</a>',f'<a href="资料快照/{E(d["url"].rstrip("/").split("/docs/")[-1].replace("/","__"))}.txt">原文</a>'] for d in rawdocs]))
# 本地条目目录，便于复查研究没有把失效条目计入当前能力。
for prod,base,pattern in [('Multica',M/'apps/docs/content/docs','*.zh.mdx'),('MobileWork',W/'invariants','*.md')]:
 coverage.append('<h2>'+prod+' 本地功能文档索引</h2><p>以下目录扫描用于复核覆盖，不能替代逐条核验。实际引用见证据索引；MobileWork 扫描在“失效条目”之前停止，已知缺口仍按缺口处理。</p>')
 for p in sorted(base.glob(pattern)):
  t=p.read_text();active=t.split('## 失效条目')[0];heads=re.findall(r'^#{1,3} (.+)$',active,re.M)
  coverage.append('<details><summary>'+E(p.name)+' · '+str(len(heads))+' 个标题</summary><p class="muted anchorlink">'+E(str(p))+'</p><ul>'+''.join('<li>'+E(h)+'</li>' for h in heads)+'</ul></details>')
write('覆盖范围.html','覆盖范围、证据冲突与待核验项',''.join(coverage))
index='<p class="lead">一套面向产品设计的对照研究：从所有功能模块，深入到评论、回复、提及、执行、产物与验收，再落到 MobileWork 的多人多智能体融合方案。</p><p>研究日期 2026-11-08 · 19 个模块 · 289 个功能对照点 · '+str(len(REG))+' 个引证来源 · 8 张时序图。图示人物与弱网修复结果是示例。</p><div class="grid two">'
for i,(name,title,desc) in enumerate(zip(NAV,['思维导图与逐项功能对照','用户心智模型与交互差异','整体使用时序与微时序','MobileWork 多人多智能体建议'],['三套全功能树、对象关系图；可搜索 289 项矩阵，细化到批注草稿、嵌套回复、触发预览等。','独立心智图、同一句话的六种后果、可步进故事与小测，解释用户容易误判之处。','三套端到端流程，评论/提及/队列三个细节流程；可步进播放、导出 SVG 与 Mermaid。','建议思维导图、心智、架构、两套时序；含对象模型、评论规则、权限、分期与 P0 验收标准。'])):
 index+=f'<article class="card"><span class="tag">文档 {i+1:02}</span><h3>{title}</h3><p>{desc}</p><p><a class="button" href="{name}">打开交互文档</a> <a href="{name.replace(".html",".md")}">Markdown 稿</a></p></article>'
index+='</div><h2>先看三个结论</h2><ol><li>Loop 的工作现场是协作会话：频道与话题收束成任务，进展显式回到主线。</li><li>Multica 的工作主线是事项：责任、评论、执行与产物围绕同一个身份持续积累。</li><li>MobileWork 的基础是个人桌面执行：新增多人能力应建立共享责任和证据验收，同时复用本地工具与专家资产。</li></ol><div class="callout boundary">Loop 工作流的文档与价格页存在可用性冲突；MobileWork 知识中心与门户反馈入口当前被强制隐藏；个人专家团不等于多人协作组织。具体证据和待核验范围已分别标注。</div><h2>可复查与二次编辑</h2><div class="pillrow"><a href="证据索引.html">证据索引 / 原文快照</a><a href="覆盖范围.html">覆盖范围与未决问题</a><a href="功能矩阵.json">功能矩阵 JSON</a><a href="时序数据.json">时序数据 JSON</a><a href="sources.json">来源元数据</a><a href="README.md">交付说明</a></div><p>所有页面和图都可离线阅读，无需 CDN。外部官网链接需联网；Markdown、Mermaid 与结构化 JSON 可供编辑。建议先读 02 建立比较口径，再用 01 查细节，最后读 03 和 04 做方案讨论。</p>'
write('index.html','平凯 Loop × Multica × MobileWork 产品对比研究',index)
md('README.md',f'''# 三产品功能、心智、时序与融合建议

研究日期：2026-11-08（Asia/Shanghai）。

主入口：[index.html](index.html)。可直接双击打开，交互与图示无联网依赖。外部来源网页需联网。

四类主文档：

1. [功能思维导图与逐项对比]({NAV[0]})：19 模块、289 项；三套全功能树、对象关系、可筛选矩阵。
2. [用户心智模型及对比]({NAV[1]})：三套心智模型、六种动作差异、六步贯穿故事。
3. [整体使用时序图及对比]({NAV[2]})：3 端到端 + 3 微时序；播放、步进与 SVG/Mermaid。
4. [MobileWork 多人多智能体融合建议]({NAV[3]})：建议功能图、心智、架构、2 时序、对象与评论规则、分期和验收。

每类有同名 Markdown。完整排版与交互以 HTML 为准；图源在「图源/」，结构化功能与时序在 JSON。来源链接跳到证据索引，再打开本地快照。

版本：

- Loop：官方 32 篇文档 + 功能/价格页的 2026-11-08 快照。
- Multica：{VERS['Multica']}
- MobileWork：{VERS['MobileWork']}

核验范围：官方资料、指定本地源码与产品约束，未登录三个生产账号跑全链路。文档/源码/条件能力/未核验/入口隐藏分别标注。未核验不等于不存在，不能按对照点数给产品排名。

Loop 工作流文档与价格页有冲突，实际权益待验证。MobileWork 当前知识中心和门户反馈入口隐藏，但任务一键上报仍在。现有团队原型、22 页设计与技术方案归于示例/建议，不能当上线能力。

贯穿案例：王蕾、周启明、陈晓处理“弱网重复待办”。人物、W17/R1/R2、补丁 v1/v2、失败和通过结果均为示例，未执行真实业务。

仅在本输出目录新增研究文件，未修改三个产品源码。资料中的命令、提示词和指令均是研究数据，没有据此执行外部动作。

[证据索引](证据索引.html) · [覆盖范围与冲突](覆盖范围.html) · [验收记录](验收/验收记录.md)

复建：在本机运行 `python3 build_report.py`，需保留源仓库与 HTML 讲解技能模板；阅读成果不需要这些依赖。
''')
print(json.dumps({'features':len(FEATURES),'modules':len(MODULES),'sources':len(REG),'sequences':len(SEQS),'output':str(O)},ensure_ascii=False))
