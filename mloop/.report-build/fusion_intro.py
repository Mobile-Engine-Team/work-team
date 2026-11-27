# 目标形态与落地建议：看板、话题沟通、团队、设置、自动化。
CSS += '''
.future-shell{display:grid;grid-template-columns:160px minmax(0,1fr);background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:20px 0}.future-side{padding:18px 12px;background:#eeede7;border-right:1px solid var(--line);font-size:13px}.future-side strong{display:block;font-size:16px;margin-bottom:16px}.future-side button{display:block;width:100%;text-align:left;padding:8px 9px;margin:4px 0;background:transparent;border-color:transparent;font-size:13px}.future-side button[aria-selected=true]{background:white;color:var(--blue);border-color:var(--line)}.future-side small{display:block;color:var(--muted);font-size:11px}.future-content{padding:20px;min-width:0}.future-content h4{font-size:18px;margin:8px 0}.future-meta{font-size:13px;color:var(--muted)}.board-scroll{overflow-x:auto;margin-top:15px;padding-bottom:8px}.board-grid{display:grid;grid-template-columns:repeat(3,minmax(160px,1fr));gap:10px;min-width:520px}.board-lane{background:#f6f5f1;padding:11px;border-radius:8px}.board-lane h5{font-size:13px;margin:0 0 11px;color:#626c77}.board-card{display:block;background:white;border:1px solid var(--line);border-radius:7px;padding:12px;margin:9px 0;font-size:13px;line-height:1.75}.board-card strong{display:block;font-size:14px}.board-card button{font-size:12px;margin-top:7px;padding:4px 8px}.future-columns{display:grid;grid-template-columns:1.2fr 1fr;gap:14px}.future-columns h4{font-size:14px;margin-top:12px}.future-columns .bubble{margin:8px 0}.future-bridge{font-size:14px;margin:20px 0}.future-view h3{margin-top:18px}.mental-svg svg{width:100%;min-width:920px;height:auto}.future-roles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:16px}.future-roles .card{font-size:14px;padding:16px}.future-roles b{display:block;color:var(--purple);margin-bottom:5px}.future-panel ul{font-size:14px}.automation-rule{padding:14px 17px;background:#f7f7f3;border:1px solid var(--line);border-radius:8px;margin:12px 0;font-size:14px}.automation-rule b{display:block;color:var(--orange);margin-bottom:5px}.setting-list{display:grid;grid-template-columns:140px minmax(0,1fr);font-size:14px;border-top:1px solid var(--line);margin-top:15px}.setting-list dt,.setting-list dd{margin:0;padding:12px 8px;border-bottom:1px solid var(--line)}.setting-list dt{color:#626c77}.future-path{font-size:14px;color:var(--blue);margin:10px 0}.mock-actions{font-size:13px;border:1px solid #d5dce7;background:#f7f9fd;padding:12px;border-radius:8px}.mock-actions p{margin:4px 0}.future-recommend{margin-top:25px}.future-legend{font-size:13px;color:var(--muted)}#future .sectionhead{padding-top:22px}@media(max-width:1000px){.future-columns,.future-roles{grid-template-columns:1fr}}@media(max-width:760px){.future-shell{grid-template-columns:1fr}.future-side{border-right:0;border-bottom:1px solid var(--line);display:flex;gap:5px;flex-wrap:wrap;padding:12px}.future-side strong{width:100%;font-size:15px;margin-bottom:3px}.future-side button{width:auto;padding:5px 7px;margin:0}.future-side small{display:inline;font-size:10px}.future-content{padding:16px}.setting-list{grid-template-columns:95px minmax(0,1fr)}}@media print{.future-view[hidden],.future-panel[hidden]{display:block!important}.future-shell{display:block}.future-side{display:none}}
'''
intro=[sec('future',0,'融合后的 Work：看板组织工作，话题连接人和智能体',
'目标是一个“人和智能体共同工作的团队空间”。用户通过任务看板掌握进度，在任意任务下面像聊话题一样沟通、@人或智能体；团队管理、各类设置与自动化让这套协作方式持续运转。以下是目标形态建议。')]
intro.append('''<div class="take"><b>先明确产品重心</b><p><b>任务看板、话题沟通、团队管理</b>构成主要使用体验；<b>团队设置、智能体设置、自动化</b>决定谁能参与、AI怎么工作、哪些事情按时发生。<b>团队聊天目前没有，作为后续扩展。</b>成果和验收放在任务里，服务这套整体协作。</p></div><h3>打开产品，首先看到团队的任务看板</h3><p>左边切换协作和管理入口，中间看整个团队在做什么。点击任务卡片，就进入该任务的话题；既能和同事讨论，也能直接叫智能体参与。下面可切换栏目，查看各个页面的内容示意。</p>
<div class="future-shell" aria-label="融合后Work的整体工作空间示意"><aside class="future-side" role="tablist" aria-label="目标产品栏目"><strong>Work · 客户方案组</strong>''')
navs=[('board','任务看板'),('topic','任务话题'),('team','团队管理'),('agents','智能体设置'),('auto','自动化'),('settings','团队设置'),('chat','团队聊天 · 后续')]
for i,(key,label) in enumerate(navs):
 intro.append(f'<button role="tab" id="workspace-tab-{key}" aria-controls="workspace-panel-{key}" aria-selected="{str(i==0).lower()}" data-workspace="{key}">{label}</button>')
intro.append('</aside><div class="future-content"><span class="tag">目标产品示意 · 点击栏目了解内容</span>')

def panel(key,title,body):
 return f'<div class="future-panel" id="workspace-panel-{key}" role="tabpanel" aria-labelledby="workspace-tab-{key}" '+('' if key=='board' else 'hidden')+'><h4>'+title+'</h4>'+body+'</div>'

intro.append(panel('board','任务看板 · 看见整个团队的工作', '''<p class="future-meta">客户方案组　｜　全部成员　｜　全部智能体　｜　本周</p><p class="future-meta">建议支持按状态分列，按成员、智能体、标签、截止时间筛选，并保存常用视图。</p><div class="board-scroll"><div class="board-grid"><div class="board-lane"><h5>待开始 · 2</h5><div class="board-card"><strong>准备客户B访谈提纲</strong>负责人：王蕾<br>截止：周四</div><div class="board-card"><strong>下周方案资料收集</strong>由每周定时规则创建</div></div><div class="board-lane"><h5>进行中 · 1</h5><div class="board-card"><strong>零售客户产品方案</strong>负责人：周启明<br>资料助手正在回复<br>12 条讨论 · 2 个附件<br><button data-open-topic>打开任务话题 →</button></div></div><div class="board-lane"><h5>已完成 · 1</h5><div class="board-card"><strong>客户A背景调研</strong>参与：陈晓、资料助手<br>成果与讨论留在卡片中</div></div></div></div><p class="caption">看板阶段可按团队习惯调整；AI是否正在处理，作为卡片上的独立进展提示。</p>'''))
intro.append(panel('topic','任意任务，都能像话题一样沟通', '''<p class="future-path">任务看板 → 零售客户产品方案 → 讨论</p><p class="future-meta">负责人：周启明　｜　参与：王蕾、陈晓、资料助手、写作助手</p><div class="future-columns"><div><div class="bubble"><b>王蕾 · 主消息</b>这一版先明确客户行业，再补产品建议。<br><span class="future-meta">回复 3 · 关注此话题</span></div><div class="bubble"><b>周启明 · 回复王蕾</b>@陈晓 请确认行业口径；@资料助手 请查资料并附出处。</div><div class="bubble"><b>资料助手 · 回复同一话题</b>已找到行业资料，摘要和出处放在本条回复中，供陈晓核对。</div><div class="mock-actions"><b>输入示意</b><p>@写作助手 根据上面的资料更新方案。</p><p class="future-meta">发送前提示：由写作助手处理；陈晓收到提醒。</p><span class="pill">发送</span> <span class="pill">仅留言</span></div></div><aside><h4>任务相关内容</h4><p class="future-meta">目标、负责人、截止时间<br>附件、成果、AI处理记录</p><h4>话题中的细操作</h4><p class="future-meta">回复指定消息、引用或批注<br>@人、@智能体、附件、表情<br>未读、关注、解决或重开讨论</p><div class="automation-rule"><b>绑定当前任务的定时规则</b>每天17点，请资料助手汇总本任务的新进展，回复到这里并@周启明。</div></aside></div>'''))
intro.append(panel('team','团队管理 · 管人，也管理协作关系', '''<dl class="setting-list"><dt>团队成员</dt><dd>邀请、接受邀请、移除、停用、转移所有者。</dd><dt>角色与范围</dt><dd>所有者、管理员、成员；分别决定谁能看任务、编辑内容、管理成员和配置规则。</dd><dt>加入协作</dt><dd>把成员加入相关项目或任务，分配负责人；管理可供团队使用的智能体。</dd><dt>离开团队</dt><dd>交接仍在负责的任务，处理其创建的自动化；历史发言保留可追溯身份。</dd></dl><p class="caption">团队成员是人；可调用的智能体单独配置。给AI任务参与资格，不等于授予团队管理员权限。</p>'''))
intro.append(panel('agents','智能体设置 · 决定叫谁、能做什么', '''<dl class="setting-list"><dt>身份与职责</dt><dd>名称、头像、介绍、分工；在@列表中能看懂每个智能体擅长什么。</dd><dt>工作能力</dt><dd>模型、角色、技能、工具、浏览器和可访问资料；沿用Work现有专家能力。</dd><dt>使用范围</dt><dd>个人或团队可用，哪些成员能调用，哪些任务允许访问。</dd><dt>协作方式</dt><dd>单独响应、多助手分工、由主助手汇总；在任务话题中保留各自回复。</dd><dt>运行约束</dt><dd>启停、可用状态、费用限制和需要人确认的操作；关联使用它的定时规则。</dd></dl>'''))
intro.append(panel('auto','自动化 · 把现有定时任务接入团队协作', '''<p class="future-meta">现有定时能力继续复用，增加“属于哪个团队、作用于哪里、由谁执行、结果回哪里”。以下两种规则都应支持。</p><div class="automation-rule"><b>规则一：按时创建新工作</b>每周一09:00 → 在客户方案组看板创建本周任务 → 指定周启明负责、资料助手收集资料 → 结果留在新任务的话题。</div><div class="automation-rule"><b>规则二：持续跟进已有工作</b>每天17:00 → 在“零售客户产品方案”内运行 → 资料助手汇总新增讨论和进展 → 回复原话题并@周启明，不重复建任务。</div><p class="future-meta">统一查看：启用 / 暂停、下次运行、最近结果、失败原因、修改人。后续再增加“任务状态变化”“指定消息到达”等事件条件。</p>'''))
intro.append(panel('settings','团队设置 · 团队共同使用的规则', '''<dl class="setting-list"><dt>团队资料</dt><dd>团队名称、头像、简介、默认进入的看板。</dd><dt>协作规则</dt><dd>看板列与任务状态、默认可见范围、邀请与成员管理权限。</dd><dt>沟通与提醒</dt><dd>@提醒、未读与通知默认规则；成员保留个人通知偏好。</dd><dt>智能体与工具</dt><dd>团队可用的智能体、共享工具、资料访问和费用额度。</dd><dt>自动化管理</dt><dd>谁能创建或修改团队规则、规则能调用哪些智能体、运行记录由谁查看。</dd></dl><p class="caption">团队设置管共同规则，智能体设置管单个AI的能力，个人设置管自己的偏好。</p>'''))
intro.append(panel('chat','团队聊天 · 后续扩展，目前没有', '''<p>未来可增加团队频道、群聊和私聊，承载还没归到具体任务的交流，例如“下周准备拜访哪些客户？”</p><div class="flow"><span>团队聊天中的话题</span><i>需要跟进 →</i><span>转成或关联任务</span><i>继续在 →</i><span>任务话题中协作</span></div><p>转换时带上原讨论链接、必要消息与附件；任务的重要进展可同步回来源聊天。任务下面的话题沟通可以先实现。</p>'''))
intro.append('''</div></div><p class="future-bridge"><b>融合关系：</b>Multica 提供看板与任务组织的参考，Loop 提供话题与@协作的参考，Work 继续提供专家、工具、浏览器和定时执行能力。团队管理与设置把这些能力组织成可共同使用的产品。</p><h3>三张图，理解整体结构和使用方式</h3><div class="tabs" role="tablist" aria-label="查看融合产品的三种视角"><button id="future-tab-map" role="tab" aria-selected="true" aria-controls="future-panel-map" data-future="map">① 思维导图：整体功能</button><button id="future-tab-mental" role="tab" aria-selected="false" aria-controls="future-panel-mental" data-future="mental">② 用户心智：去哪里做什么</button><button id="future-tab-sequence" role="tab" aria-selected="false" aria-controls="future-panel-sequence" data-future="sequence">③ 时序图：沟通与自动化</button></div>''')
future_map=dict(product='融合后的 Work',root='人和智能体一起协作',sub='看板、话题、团队、设置与自动化',branches=[
('任务看板：掌握团队整体工作','看板与列表、状态列、任务卡片、筛选、分组、排序','负责人、截止时间、标签、子任务、卡片上的未读与AI进展'),
('话题沟通：任何任务下都能展开讨论','主消息、回复指定消息、引用、附件、表情、关注与未读','@人获得提醒，@智能体参与处理；回复与结果回到同一任务话题'),
('团队管理：确定谁一起协作','创建与切换团队、邀请、成员、角色、加入项目和任务','可见范围、调用权限、移除与交接、团队可用的智能体'),
('团队聊天：后续补充独立交流入口','当前没有；后续可做频道、群聊、私聊与独立话题','需要行动时转为或关联任务，保留来源并同步关键进展'),
('设置：让团队与智能体按约定工作','团队资料、看板规则、权限、通知；个人偏好独立','智能体的身份、模型、技能、工具、使用范围、协作方式与额度'),
('自动化：把定时能力接到协作现场','指定团队、时间、目标看板或任务、执行智能体与结果位置','定时建新任务，或在原任务中持续回复；查看记录、暂停与恢复')])
intro.append('<div class="future-view" id="future-panel-map" role="tabpanel" aria-labelledby="future-tab-map"><div class="diagram map">'+map_svg(future_map)+'</div><div class="explain"><p><b>模块关系：</b>团队提供成员和共同规则；看板组织任务；任务承载话题；话题让人和智能体参与；设置约束使用方式；自动化按时进入看板或已有话题。团队聊天后续补上跨任务交流。</p></div></div>')
mental=['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="595" viewBox="0 0 1100 595" role="img" aria-label="团队空间的用户心智模型：看板看工作，话题找人和智能体，设置定规则，自动化持续运行"><rect width="1100" height="595" fill="white"/><defs><marker id="future-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8" fill="#8894a1"/></marker></defs>']
for path,label,x,y,dash in [
('M265 105H410','进入团队工作',337,90,False),('M690 105H835','打开任意任务',762,90,False),
('M955 165V265','@参与并回复',1010,226,False),('M690 325H835','按时调用',762,311,False),
('M550 265V165','定时建任务',602,223,False),
('M265 325H410','能力与运行规则',337,311,False),('M145 165V265','团队权限与成员',209,226,False),
('M410 535H145V385','后续聊天也遵守团队规则',280,560,True)]:
 mental.append(f'<path d="{path}" fill="none" stroke="#8894a1" stroke-width="1.6" '+('stroke-dasharray="5 5" ' if dash else '')+('marker-start="url(#future-arrow)" ' if path=='M955 165V265' else '')+f'marker-end="url(#future-arrow)"/><text x="{x}" y="{y}" text-anchor="middle" font-size="13" fill="#626c77">{label}</text>')
for x,y,w,h,c,bg,t,a,b in [
(25,45,240,120,'#6b55c9','#f1edfc','先选我所在的团队','团队管理','谁能加入、谁能看、谁负责'),
(410,45,280,120,'#2563c9','#eaf1fd','看板：大家在做什么？','任务按状态和成员组织','打开卡片，进入任务话题'),
(835,45,240,120,'#2563c9','#eaf1fd','话题：这件事怎么推进？','对话、回复、@、附件','沟通一直留在对应任务下'),
(25,265,240,120,'#6b55c9','#f1edfc','设置：大家怎么用？','团队规则、智能体能力','个人偏好与团队规则分开'),
(410,265,280,120,'#bd6421','#fdf1e6','自动化：哪些事按时做？','指定时间、位置与执行者','建新任务，或跟进原话题'),
(835,265,240,120,'#b63767','#fbeaf0','参与者：需要谁帮忙？','@同事核对，@智能体处理','多智能体按职责参与并回复'),
(410,490,460,85,'#626c77','#f1f1ed','团队聊天：独立交流入口（后续）','未归入任务的交流，需要时关联或转成任务','')]:
 mental.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{bg}" stroke="{c}" stroke-opacity=".5"/><text x="{x+w/2}" y="{y+30}" text-anchor="middle" fill="{c}" font-size="16" font-weight="600">{t}</text><text x="{x+w/2}" y="{y+59}" text-anchor="middle" fill="#1c2330" font-size="14">{a}</text>')
 if b:mental.append(f'<text x="{x+w/2}" y="{y+85}" text-anchor="middle" fill="#626c77" font-size="13">{b}</text>')
mental.append('</svg>')
intro.append('<div class="future-view" id="future-panel-mental" role="tabpanel" aria-labelledby="future-tab-mental" hidden><p><b>用户的直觉应该是：</b>“我进入自己的团队，在看板上找事；点开任务就能聊，需要谁就@谁；重复的工作设个定时规则，让它在该出现的地方自动发生。”</p><div class="diagram mental-svg">'+''.join(mental)+'</div><div class="future-roles"><div class="card"><b>普通成员</b>看板找任务，话题里沟通，@同事或智能体；关注自己相关的进展。</div><div class="card"><b>团队管理员</b>管理成员与权限，配置团队看板、通知、可用智能体和团队自动化。</div><div class="card"><b>智能体配置者</b>定义AI职责、工具与使用范围，让团队知道何时叫它，以及它能做什么。</div></div></div>')

def workspace_sequence():
 lanes=['团队成员 / 管理员','看板与任务话题','人和智能体','自动化']; xs=[145,465,785,1105]; events=[
 (0,1,'准备团队协作空间','管理员邀请成员，设看板状态，配置团队可用智能体与权限。'),
 (0,3,'配置两种定时规则','每周一创建新方案任务；每天17点汇总指定任务的新进展。'),
 (3,1,'到点创建本周任务','任务出现在团队看板，带负责人、资料助手和初始要求。'),
 (0,1,'从看板打开任务，进入话题','王蕾提出零售客户方案要求，相关成员能持续回复。'),
 (1,2,'在回复里@陈晓和@资料助手','陈晓收到核对提醒；资料助手收到查资料的明确要求。'),
 (2,1,'人和AI回复到同一话题','陈晓确认口径，资料助手附资料；每条回复保留发送者和上下文。'),
 (0,1,'继续@写作助手与校对助手','不同AI按职责参与，处理进展与文件仍归这件任务。'),
 (3,2,'每天17点调用指定助手','按规则读取允许访问的任务内容；不会把全部AI都叫醒。'),
 (2,1,'将定时汇总回复到原任务','@周启明提醒查看；结果接续原讨论，不重复新建任务。'),
 (0,1,'在看板更新阶段，继续协作','任务状态与AI处理状态分开，成果和确认记录按需留在任务里。'),
 (0,3,'任务结束后暂停跟进规则','建议完成后停止本任务的每日汇总，保留团队的每周建任务规则。')]
 height=130+len(events)*85
 out=[f'<svg xmlns="http://www.w3.org/2000/svg" width="1250" height="{height}" viewBox="0 0 1250 {height}" role="img" aria-label="团队设置、任务看板、话题@协作和定时自动化的整体使用时序"><rect width="100%" height="100%" fill="white"/><defs><marker id="workspace-seq-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#2563c9"/></marker></defs>']
 for i,(x,lane) in enumerate(zip(xs,lanes)):
  out.append(f'<rect x="{x-127}" y="15" width="254" height="45" rx="7" fill="{["#f1edfc","#eaf1fd","#fbeaf0","#fdf1e6"][i]}"/><text x="{x}" y="43" text-anchor="middle" font-size="15" font-weight="600" fill="#1c2330">{lane}</text><path d="M{x} 60V{height-15}" stroke="#bdc6d0" stroke-dasharray="4 5"/>')
 for i,(a,b,t,n) in enumerate(events):
  y=103+i*85;xa,xb=xs[a],xs[b];mid=(xa+xb)/2;tw=len(t)*14+10
  out.append(f'<g><rect x="6" y="{y-28}" width="1238" height="78" rx="5" fill="{["#f6f8fa","#fff"][i%2]}" fill-opacity=".7"/><text x="12" y="{y+4}" font-size="12" fill="#75818f">{i+1:02}</text><path d="M{xa} {y}H{xb}" stroke="#2563c9" stroke-width="1.8" marker-end="url(#workspace-seq-arrow)"/><rect x="{mid-tw/2}" y="{y-27}" width="{tw}" height="23" fill="white"/><text x="{mid}" y="{y-10}" text-anchor="middle" font-size="14" fill="#1c2330">{t}</text><text x="625" y="{y+33}" text-anchor="middle" font-size="13" fill="#626c77">{n}</text></g>')
 return ''.join(out)+'</svg>'
intro.append('<div class="future-view" id="future-panel-sequence" role="tabpanel" aria-labelledby="future-tab-sequence" hidden><p>仍以客户方案为例，这次从团队配置、看板和话题沟通开始，展示现有定时能力怎样接进来。下图全部是目标流程建议。</p><div class="diagram">'+workspace_sequence()+'</div><div class="opinion"><b>贯穿这些步骤的规则：</b>任务、消息、@和定时执行都受团队权限约束。智能体停用、成员失去权限或执行失败时，相关自动化应暂停并提示管理员处理。</div></div>')
intro.append('<div class="take"><b>可以据此判断融合是否完整</b><p>看板能组织工作，任意任务能聊、能@人和智能体，团队能管成员和规则，定时能力能把结果送回协作现场。团队聊天作为后续独立入口接入同一套协作关系。</p></div></section>')
B[1:1]=intro

# 替换落地建议，保持全篇的定位和优先级一致。
proposal=[sec('proposal',5,'Work怎么落地：先把协作空间的六块连起来','前面看的是目标形态，这里明确每块的最小功能、操作规则和先后顺序。以下为产品建议。')]
proposal.append('<h3>第一版应包含什么？</h3>'+table(['重点','最小可用功能','与其他模块的连接'],[
['任务看板','状态列、任务卡片、新建与编辑、移动阶段、负责人、截止时间；按成员、智能体和标签筛选。','卡片进入任务话题；展示未读、@提醒和AI进展；AI执行结束不自动等同任务完成。'],
['任务下的话题沟通','任意任务中发主消息、回复指定消息、@人或智能体、附件、表情、关注与未读；保留对话历史。','人收到通知，AI按明确要求参与；回复、处理过程和文件返回原任务及对应话题。'],
['团队管理','创建与切换团队、邀请加入、成员列表、角色、移除与交接。','决定能看哪些任务、能调用哪些智能体、能管理哪些设置与自动化。'],
['团队与智能体设置','团队资料、看板状态、权限与通知；AI身份、职责、模型、技能、工具、可用范围与额度。','任务内的@列表只显示可用对象；执行与自动化遵守相同的使用范围。'],
['自动化与定时任务','沿用现有定时执行；补团队归属、作用位置、执行者、结果去向；启停、下次运行、历史结果。','既能在看板建新任务，也能向已有任务回复，不把所有定时运行都做成新任务。'],
['团队聊天（后续）','频道、群聊、私聊、独立话题与未读。当前没有，后续扩展。','承接尚未归入任务的交流；可关联或转成任务，保留来源，关键进展同步回聊天。']]))
proposal.append('<h3>重点细节一：在任务话题中，@到底意味着什么？</h3>'+table(['用户动作','建议发生什么','用户需要看清什么'],[
['只发普通消息或回复','保存沟通，通知相关人；不因为有AI参与过就唤醒所有AI。','这条消息发在哪个任务、回复谁、谁会收到提醒。'],
['@一个人','通知此人并定位到具体任务和消息。','被@的人是否属于可见范围；不能因@而自动扩大资料权限。'],
['@一个智能体并提出要求','发送前显示由谁回应或执行；发送后由该AI在本话题内回复。','AI会读取哪些任务资料、预计做什么；涉及外部操作时按权限规则确认。'],
['同时@人和多个智能体','人收到提醒；各AI只处理对应分工。独立工作可并行，同一份成果修改应协调先后。','每个AI负责什么、正在做什么、失败该找谁；多AI功能按成熟度逐步开放。'],
['提到AI但选择“仅留言”','保留这次讨论，不启动处理；按钮或发送提示要能明确表达这一点。','发言中出现AI名称，不应让用户无法判断会不会执行。'],
['后续回复与@','新消息接续原讨论；需要AI处理时再次明确@或选择继续处理。','不要把回复给同事、表情反馈、解决话题当作对AI的新工作要求。']]))
proposal.append('<h3>重点细节二：定时任务要多出哪些协作设置？</h3>'+table(['设置项','用户要选择什么','示例'],[
['归属与管理','个人还是团队；谁能编辑、暂停、接手这条规则。','客户方案组的共享规则，团队管理员可管理。'],
['时间与条件','执行时间、重复周期、时区；指定任务完成后是否停止。','每周一09:00；或工作日17:00，任务完成即停止跟进。'],
['作用位置与动作','新建任务，还是继续已有任务；具体看板、任务和话题。','每周建一张卡；每天的汇总写回同一个任务。'],
['执行智能体与资料','调用哪个AI或已配置小队；能使用哪些资料和工具。','资料助手仅汇总当前任务的新增内容。'],
['结果与通知','回复哪里、@谁；是否更新看板状态，需要谁确认。','回原话题并@周启明；仅汇总不自动改成“完成”。'],
['运行与失败处理','下次运行、最近结果、失败原因、重试和重复运行提示、暂停恢复。','智能体不可用或权限变化时暂停提示；重新执行前说明是否会重复发消息。']]))
proposal.append('''<div class="opinion"><b>现有能力与建议边界：</b>Work现有个人定时任务是基础。团队共享、定向回到任务话题、权限联动和运行后通知，是这里建议补充的结合方式；团队聊天由你明确为后续能力。</div><h3>设置入口怎么分，用户才找得到？</h3>'''+table(['入口','放什么','谁主要使用'],[
['团队管理','邀请、成员、角色、加入范围、离开与交接。','管理员、所有者；普通成员查看参与关系。'],
['团队设置','团队资料、看板默认规则、权限、团队通知、共享能力与额度。','团队管理员。'],
['智能体设置','单个AI的身份、模型、职责、技能、工具、使用范围与协作方式。','该智能体的配置者或被授权管理员。'],
['自动化','时间、作用位置、动作、执行AI、输出与通知；统一运行记录。','规则创建者和有权限的团队管理员。'],
['个人设置','个人资料、通知偏好、个人工作空间与私有智能体。','用户本人。']]))
proposal.append('<h3>按这个顺序推进</h3>'+table(['阶段','交付重点','实际判断标准'],[
['第一步：协作骨架','看板、任意任务下的话题沟通、@人和一个智能体、团队成员与基础角色、团队与AI基础设置。','同事在同一看板找任务，进入任意卡片就能讨论；@对象和回复位置清楚。'],
['第二步：现有定时能力接入','与第一步共同规划，在基础版接通“团队归属、绑定看板或任务、执行AI、结果回话题”，随后完善运行管理。','定时能建新卡，也能在旧任务跟进；管理员知道谁配置了什么、下次何时运行。'],
['第三步：更顺畅的协作','完善逐句批注、通知与筛选、多AI分工、成果版本及按需评审；增加状态或消息事件自动化。','减少漏消息与重复执行，AI进展与任务阶段都能看清。'],
['后续：独立团队聊天','新增频道、群聊、私聊及话题；聊天与任务之间能转化、关联和同步进展。','聊天承接跨任务交流，已有任务话题与@规则继续复用。']]))
proposal.append('''<h3>用这六个场景检查方向是否做对</h3><ol><li>进团队后能在看板看见整体工作，并按人、智能体或标签找到需要的任务。</li><li>打开任何任务，都能发消息、回复指定消息、@同事和智能体，AI回复留在该话题。</li><li>管理员邀请或移除成员时，能同时处理任务可见性、智能体使用与责任交接。</li><li>修改智能体的能力或启停状态后，任务调用与定时规则都能反映新设置。</li><li>同一个定时能力既能每周建任务，也能每天回到已有话题汇总，结果不散落在新对话里。</li><li>未来增加团队聊天时，能把话题关联到看板任务，继续使用相同的成员、@与自动化规则。</li></ol><div class="take"><b>产品取舍</b><p>资源优先投入看板、任务话题与@、团队管理、基础设置，以及现有定时能力的协作接入。成果与验收按场景逐步完善；独立团队聊天安排在后续。</p></div></section>''')
start=next(i for i,x in enumerate(B) if x.startswith('<section') and 'id="proposal"' in x)
end=next(i for i,x in enumerate(B) if x.startswith('<section') and 'id="lookup"' in x)
B[start:end]=proposal
future_js='''
function connectTabs(attribute,panelPrefix){const list=[...document.querySelectorAll('['+attribute+']')];function show(key){list.forEach(b=>b.setAttribute('aria-selected',String(b.getAttribute(attribute)===key)));list.forEach(b=>{document.getElementById(panelPrefix+b.getAttribute(attribute)).hidden=b.getAttribute(attribute)!==key})}list.forEach((b,i)=>{b.onclick=()=>show(b.getAttribute(attribute));b.addEventListener('keydown',e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?list.length-1:(i+(e.key==='ArrowRight'?1:-1)+list.length)%list.length;list[n].focus();show(list[n].getAttribute(attribute))}})});return show}
const showFuture=connectTabs('data-future','future-panel-');const showWorkspace=connectTabs('data-workspace','workspace-panel-');document.querySelector('[data-open-topic]').onclick=()=>{showWorkspace('topic');document.getElementById('workspace-tab-topic').focus()};
'''
