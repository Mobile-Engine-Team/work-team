# 冻结 Demo V2 迁移差异与复验索引

每个编号链接到冻结原版的条件、操作和判据。右栏只登记实际运行的条件；同一编号下的其他分支仍按原版条目核验。原生、浏览器和后台断言按来源分别保留。角色 A 为合成团队所有者，B 为成员。

冻结客户端提交为 `dbf36f4`，Multica 提交为 `a7859a4`。构建和启动环境见[验收入口](README.md)，组件迁移见[控件反查](controls.md)。旧库按 D-02～D-06 选择以新账号重建。

## 01-启动与工作区

|编号与条件|实施和证据判定|迁移版实际观察及复验材料|
|---|---|---|
|[OS-01](../demo-v2-baseline/01-启动与工作区.md#os-01) 从刚恢复的 Mac 资料启动 A，B 使用独立资料|已记录所列条件|url=http://127.0.0.1:19116/#/team、viewport={'width': 1180, 'height': 810, 'dpr': 2, 'language': 'en-US'} [macos](macos/shell.json)<br>新测试资料打开产品。中文登录页，账号聚焦，密码为空。 [native](native/results.json) [图](native/01-login.png)|
|[OS-02](../demo-v2-baseline/01-启动与工作区.md#os-02) Finder 双击未带参数的冻结 .app|已记录所列条件|url=http://127.0.0.1:19116/#/team、viewport={'width': 1180, 'height': 810, 'dpr': 2, 'language': 'en-US'} [macos](macos/shell.json)|
|[OS-03](../demo-v2-baseline/01-启动与工作区.md#os-03) 在 B 的系统菜单栏展开应用菜单|已记录所列条件|五个应用菜单逐项与冻结 AX 枚举匹配 [macos](macos/shell.json)|
|[OS-04](../demo-v2-baseline/01-启动与工作区.md#os-04) 文件→关闭窗口（或红钮）；再显示同一窗口|已记录所列条件|redButton=hidden、samePid=True、sameInput=shell_check [macos](macos/shell.json)|
|[OS-05](../demo-v2-baseline/01-启动与工作区.md#os-05) 编辑菜单，焦点置于登录输入、任务要求或评论编辑框|已记录所列条件|五个应用菜单逐项与冻结 AX 枚举匹配 [macos](macos/shell.json)|
|[OS-06](../demo-v2-baseline/01-启动与工作区.md#os-06) 显示→重新加载、强制重新加载；实际大小、放大、缩小、切换全屏、开发者工具|已记录所列条件|五个应用菜单逐项与冻结 AX 枚举匹配 [macos](macos/shell.json)|
|[OS-07](../demo-v2-baseline/01-启动与工作区.md#os-07) 窗口→最小化、缩放、全部置于顶层、窗口项；托盘→显示主窗或退出|已记录所列条件|五个应用菜单逐项与冻结 AX 枚举匹配 [macos](macos/shell.json)<br>restored=True、samePid=True [macos](macos/shell.json)|
|[OS-08](../demo-v2-baseline/01-启动与工作区.md#os-08) 个人/团队区内点 Markdown 普通外链、工作台答案中的 URL；Windows 题头按钮|已记录所列条件|已有纯 Markdown 与部分失败的回答，包含失配的历史布局。Markdown 正常排版；链接、图片作受限文本。失败回答保留已核对的陈述，可重答且不能固定。 [projects-workbench](projects-workbench/results.json)|
|[AU-01](../demo-v2-baseline/01-启动与工作区.md#au-01) A/B 新资料开窗|已记录所列条件|新测试资料打开产品。中文登录页，账号聚焦，密码为空。 [native](native/results.json) [图](native/01-login.png)|
|[AU-02](../demo-v2-baseline/01-启动与工作区.md#au-02) 输入账号后切“没有账号？注册账号”，再切回登录|已记录所列条件|A/B 分别注册，先提交两次不同的密码。两端都提示密码不一致，改正后分别进入自己的个人工作台。 [native](native/results.json) [图](native/02-personal.png)|
|[AU-03](../demo-v2-baseline/01-启动与工作区.md#au-03) 注册时两次密码不同；改为相同提交|已记录所列条件|A/B 分别注册，先提交两次不同的密码。两端都提示密码不一致，改正后分别进入自己的个人工作台。 [native](native/results.json) [图](native/02-personal.png)|
|[AU-04](../demo-v2-baseline/01-启动与工作区.md#au-04) 已有账号错误密码、重名注册、格式不符、后端不可达分别提交|已记录所列条件|停产品 API 并恢复，再令测试身份过期。断线时显示正在恢复连接，恢复后读到原任务；会话过期回登录，后续受保护读取返回 401。 [browser-assembly](browser-assembly/results.json)<br>B 退出后用错误密码和正确密码依次登录。错误时停在登录页，正确密码回个人区。 [native](native/results.json)|
|[AU-05](../demo-v2-baseline/01-启动与工作区.md#au-05) 已登录点右上“退出账号”再登录|已记录所列条件|B 退出后用错误密码和正确密码依次登录。错误时停在登录页，正确密码回个人区。 [native](native/results.json)|
|[WS-01](../demo-v2-baseline/01-启动与工作区.md#ws-01) 顶栏工作区选择器，从个人选团队，再切回|已记录所列条件|B 接受后从个人区手动进入团队。B 见 A 而无邀请按钮，成员表回读 owner 与 member。 [native](native/results.json)|
|[WS-02](../demo-v2-baseline/01-启动与工作区.md#ws-02) 已登录但拿不到有效 slug；工作区列表加载/失败/为空|已记录所列条件|停产品 API 并恢复，再令测试身份过期。断线时显示正在恢复连接，恢复后读到原任务；会话过期回登录，后续受保护读取返回 401。 [browser-assembly](browser-assembly/results.json)<br>同一账号打开不存在的 slug 后选团队卡片。合法团队可从选择页重新进入。 [native](native/results.json)|
|[WS-03](../demo-v2-baseline/01-启动与工作区.md#ws-03) A 在顶栏选择器右侧点“＋”|已记录所列条件|打开新建工作区。名称默认聚焦，地址空白，创建禁用。 [native](native/results.json) [图](native/03-workspace-empty.png)|
|[WS-04](../demo-v2-baseline/01-启动与工作区.md#ws-04) 只填地址，名称填空格；随后改为“基线协作组”|已记录所列条件|空白名称改为非空，地址含空格。名称空白禁用，填写名称后允许提交非法地址。 [native](native/results.json)|
|[WS-05](../demo-v2-baseline/01-启动与工作区.md#ws-05) 输入名称及 bad space! 后按 Esc，再点“＋”|已记录所列条件|带输入经Esc关闭后重开。名称及地址都保留。 [native](native/results.json)|
|[WS-06](../demo-v2-baseline/01-启动与工作区.md#ws-06) 带同样输入点右上叉，再打开|已记录所列条件|带输入经叉号关闭后重开。名称及地址都保留。 [native](native/results.json)|
|[WS-07](../demo-v2-baseline/01-启动与工作区.md#ws-07) 带同样输入点遮罩，再打开|已记录所列条件|带输入经遮罩关闭后重开。名称及地址都保留。 [native](native/results.json)|
|[WS-08](../demo-v2-baseline/01-启动与工作区.md#ws-08) 点创建提交 bad space!|已记录所列条件|提交含空格及标点的地址。弹窗报告失败，两个字段保留。 [native](native/results.json) [图](native/04-workspace-invalid.png)|
|[WS-09](../demo-v2-baseline/01-启动与工作区.md#ws-09) 改地址为 baseline-team 后点创建|已记录所列条件|创建唯一地址团队。弹窗关闭，A 的工作区选择器落在新团队。 [native](native/results.json) [图](native/05-team-home.png)|
|[WS-10](../demo-v2-baseline/01-启动与工作区.md#ws-10) 再创建相同地址，更换显示名|已记录所列条件|同地址、不同名称再次提交。弹窗报错，数据库仅有一份该地址。 [native](native/results.json) [图](native/06-workspace-duplicate.png)|
|[WS-11](../demo-v2-baseline/01-启动与工作区.md#ws-11) 在相同配置人为延迟原版响应，检查连按及提交中关闭|已记录所列条件|延迟本次创建请求期间按 Esc。创建按钮 pending 禁用，仅收到一条创建请求，最终导航到对应团队且仅写入一行。 [native](native/results.json)|
|[WS-12](../demo-v2-baseline/01-启动与工作区.md#ws-12) 同一隔离库延迟写入时，在创建按钮连续点击两次，放开写入|已记录所列条件|延迟本次创建请求期间在相同位置双击。创建按钮 pending 禁用，仅收到一条创建请求，最终导航到对应团队且仅写入一行。 [native](native/results.json)|
|[IN-01](../demo-v2-baseline/01-启动与工作区.md#in-01) A 在团队成员区点“邀请成员”，B 已注册但未加入|已记录所列条件|A 邀请 B，B 留在个人区。B 在其个人区收到团队邀请和接受/稍后处理操作。 [native](native/results.json) [图](native/09-invite.png)|
|[IN-02](../demo-v2-baseline/01-启动与工作区.md#in-02) B 停在个人区，等一个轮询周期|已记录所列条件|A 邀请 B，B 留在个人区。B 在其个人区收到团队邀请和接受/稍后处理操作。 [native](native/results.json) [图](native/09-invite.png)|
|[IN-03](../demo-v2-baseline/01-启动与工作区.md#in-03) 收到邀请点“稍后处理”|已记录所列条件|先稍后处理再刷新。未接受的邀请重新出现。 [native](native/results.json)|
|[IN-04](../demo-v2-baseline/01-启动与工作区.md#in-04) B 点“接受邀请”，待页面稳定再打开顶栏选择器|已记录所列条件|B 接受后从个人区手动进入团队。B 见 A 而无邀请按钮，成员表回读 owner 与 member。 [native](native/results.json)|
|[IN-05](../demo-v2-baseline/01-启动与工作区.md#in-05) 所有者、管理员、普通成员和未加入团队的账号分别观察邀请/访问；重复邀请或账号已成为成员|已记录所列条件|B 接受后从个人区手动进入团队。B 见 A 而无邀请按钮，成员表回读 owner 与 member。 [native](native/results.json)<br>把本轮 B 从 member 临时改为 admin 后重载。管理员获得团队邀请操作。 [native](native/results.json)|
|[COMMON-01](../demo-v2-baseline/01-启动与工作区.md#common-01) 在工作区/任务等页面打开普通选择器、可搜索项目选择器和应用内弹窗|已记录所列条件|已绑定离线 Pi 的助手打开端选择器，用回车/Esc 后只编辑角色指令。原绑定仍显示、Esc 回焦到选择器，离线状态可保存该助手。 [native](native/results.json)|
|[COMMON-02](../demo-v2-baseline/01-启动与工作区.md#common-02) 测试客户端的读接口连续不可用，输入新搜索；恢复请求并触发在线事件|已记录所列条件|B 的业务读请求持续失败后恢复。出现连接状态提示，联网触发成功查询后提示消退，A 的网络仍正常。 [native](native/results.json)|
|[COMMON-03](../demo-v2-baseline/01-启动与工作区.md#common-03) 保存合法详情/评论地址，分别在同一账号、未登录、另一账号和失效对象条件下直接打开|已记录所列条件|同任务先后两次提及，B 从两条历史事件分别打开再刷新。两条不同 comment_id 分别写入路由，键盘焦点与数据库中对应原文的评论 ID 一致。 [native](native/results.json)<br>A 回答证据指向真实团队任务，B 打开相同私有会话链接。A 可查看生成时快照、跳回任务和原回答；B 有输入框，看不到 A 问答与最近项。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/27-evidence.png)|

## 02-成员与执行

|编号与条件|实施和证据判定|迁移版实际观察及复验材料|
|---|---|---|
|[AG-01](../demo-v2-baseline/02-成员与执行.md#ag-01) B 在个人区进“成员与智能体”再点“新建智能体”|已记录所列条件|sameNameRejected=True、matchingAgents=1 [macos](macos/agents.json)<br>B 个人工作区，尚无可用端。表单没有团队共享选项，空表不能保存。 [native](native/results.json) [图](native/08-agent-personal.png)|
|[AG-02](../demo-v2-baseline/02-成员与执行.md#ag-02) A 在团队区打开同名表单|已记录所列条件|A 团队区打开新建智能体。默认不共享，需选端和填写名称。 [native](native/results.json) [图](native/07-agent-team.png)|
|[AG-03](../demo-v2-baseline/02-成员与执行.md#ag-03) 未启用任何可用端，打开执行端选择器|已记录所列条件|B 个人工作区，尚无可用端。表单没有团队共享选项，空表不能保存。 [native](native/results.json) [图](native/08-agent-personal.png)|
|[EP-01](../demo-v2-baseline/02-成员与执行.md#ep-01) A 点“启用本机执行端”，等待机器行出现|已记录所列条件|providers=['claude', 'codex', 'opencode', 'pi']、runtimeBindings=['claude／4643bf38-9ffe-4e18-82f9-c55d82d8f48e／e77cd5bd-1106-4002-b0a7-bfbddea4eebf', 'codex／2354c1d0-0936-4e31-a6f6-bc12df9deb98／e77cd5bd-1106-4002-b0a7-bfbddea4eebf', 'opencode／7c934cfc-650b-4e6a-aec2-e7c5ef3f8504／e77cd5bd-1106-4002-b0a7-bfbddea4eebf', 'pi／4b0bb44c-f52e-4188-8c38-31808cb391e5／e77cd5bd-1106-4002-b0a7-bfbddea4eebf'] [macos](macos/agents.json)<br>开启本机受控执行端，Codex 手输模型后切 Pi，私有保存。名称+端才可保存，换端清除自选模型，B 的团队列表无此助手。 [native](native/results.json)|
|[EP-02](../demo-v2-baseline/02-成员与执行.md#ep-02) 展开/收折机器行，制造部分工具离线或身份错属|已记录所列条件|providers=['claude', 'codex', 'opencode', 'pi']、runtimeBindings=['claude／4643bf38-9ffe-4e18-82f9-c55d82d8f48e／e77cd5bd-1106-4002-b0a7-bfbddea4eebf', 'codex／2354c1d0-0936-4e31-a6f6-bc12df9deb98／e77cd5bd-1106-4002-b0a7-bfbddea4eebf', 'opencode／7c934cfc-650b-4e6a-aec2-e7c5ef3f8504／e77cd5bd-1106-4002-b0a7-bfbddea4eebf', 'pi／4b0bb44c-f52e-4188-8c38-31808cb391e5／e77cd5bd-1106-4002-b0a7-bfbddea4eebf'] [macos](macos/agents.json)<br>停止 A 的受控执行端。启用动作恢复；后续离线任务仍可分派给共享助手。 [native](native/results.json)|
|[EP-03](../demo-v2-baseline/02-成员与执行.md#ep-03) A 停用本机执行端，再新建智能体|已记录所列条件|offlineOptions=4、sameRuntimeIdsAfterRestart=True [macos](macos/agents.json)|
|[EP-04](../demo-v2-baseline/02-成员与执行.md#ep-04) 点“连接远程主机”；切认证方式、取消后重开|已记录所列条件|keyDialog=取消、host=127.0.0.1、port=22、residualTokens=0 [macos](macos/agents.json)<br>指纹确认取消后显示连接已取消并清空密码 [macos](macos/remote.json)<br>SSH 密码认证成功，受控远端校验转交凭据属于当前账号，返回协议级运行回执 [macos](macos/remote.json)<br>再次连接已信任的本机服务，无须再次确认 [macos](macos/remote.json)<br>同地址端口替换密钥后拒绝建立 SSH 会话，保留原表单 [macos](macos/remote.json)<br>回环端口关闭后显示连接失败，可改字段重试 [macos](macos/remote.json)<br>恰有两次成功授权，三个失败分支无未撤销的凭据 [macos](macos/remote.json)<br>仅打开 SSH 主机表单。可填写连接条件，未连接外部主机。 [native](native/results.json) [图](native/30-remote.png)<br>D-08 暂缓 外部 SSH 密码/密钥连接。|
|[EP-06](../demo-v2-baseline/02-成员与执行.md#ep-06) 选择密钥认证再点连接，在原生选私钥时取消；首次连接对比已信任主机|已记录所列条件|keyDialog=取消、host=127.0.0.1、port=22、residualTokens=0 [macos](macos/agents.json)<br>指纹确认取消后显示连接已取消并清空密码 [macos](macos/remote.json)<br>SSH 密码认证成功，受控远端校验转交凭据属于当前账号，返回协议级运行回执 [macos](macos/remote.json)<br>再次连接已信任的本机服务，无须再次确认 [macos](macos/remote.json)<br>同地址端口替换密钥后拒绝建立 SSH 会话，保留原表单 [macos](macos/remote.json)<br>回环端口关闭后显示连接失败，可改字段重试 [macos](macos/remote.json)<br>恰有两次成功授权，三个失败分支无未撤销的凭据 [macos](macos/remote.json)|
|[EP-05](../demo-v2-baseline/02-成员与执行.md#ep-05) 真实远程主机注册或连接失败|已记录所列条件|指纹确认取消后显示连接已取消并清空密码 [macos](macos/remote.json)<br>SSH 密码认证成功，受控远端校验转交凭据属于当前账号，返回协议级运行回执 [macos](macos/remote.json)<br>再次连接已信任的本机服务，无须再次确认 [macos](macos/remote.json)<br>同地址端口替换密钥后拒绝建立 SSH 会话，保留原表单 [macos](macos/remote.json)<br>回环端口关闭后显示连接失败，可改字段重试 [macos](macos/remote.json)<br>恰有两次成功授权，三个失败分支无未撤销的凭据 [macos](macos/remote.json)<br>D-08 暂缓 远端连接故障与重连。|
|[AG-04](../demo-v2-baseline/02-成员与执行.md#ag-04) A 有四个在线 CLI，点“选择执行端”选 Codex|已记录所列条件|开启本机受控执行端，Codex 手输模型后切 Pi，私有保存。名称+端才可保存，换端清除自选模型，B 的团队列表无此助手。 [native](native/results.json)|
|[AG-05](../demo-v2-baseline/02-成员与执行.md#ag-05) 点“模型（可选）”|已记录所列条件|开启本机受控执行端，Codex 手输模型后切 Pi，私有保存。名称+端才可保存，换端清除自选模型，B 的团队列表无此助手。 [native](native/results.json)|
|[AG-06](../demo-v2-baseline/02-成员与执行.md#ag-06) 在 Codex 端搜 baseline-model，点“使用…baseline-model”；再把执行端换成 Pi|已记录所列条件|开启本机受控执行端，Codex 手输模型后切 Pi，私有保存。名称+端才可保存，换端清除自选模型，B 的团队列表无此助手。 [native](native/results.json)|
|[AG-07](../demo-v2-baseline/02-成员与执行.md#ag-07) 选 Pi 后填“复验助手”“归纳测试记录”，默认不共享，保存|已记录所列条件|开启本机受控执行端，Codex 手输模型后切 Pi，私有保存。名称+端才可保存，换端清除自选模型，B 的团队列表无此助手。 [native](native/results.json)|
|[AG-08](../demo-v2-baseline/02-成员与执行.md#ag-08) A 在我的目录点“编辑智能体”，勾共享并保存；B 刷新团队目录|已记录所列条件|A 将助手改为团队共享，B 重载。B 见共享助手但无编辑入口，类型为暂不可获取。 [native](native/results.json) [图](native/10-shared-agent-member.png)|
|[AG-09](../demo-v2-baseline/02-成员与执行.md#ag-09) 已有离线或不再可选的旧端，A 编辑名称；有成员定向授权的历史智能体只改模型|已记录所列条件|originalOfflineBinding=codex／2354c1d0-0936-4e31-a6f6-bc12df9deb98、savedName=个人复验员离线改名、editedInstructions=True [macos](macos/agents.json)<br>已绑定离线 Pi 的助手打开端选择器，用回车/Esc 后只编辑角色指令。原绑定仍显示、Esc 回焦到选择器，离线状态可保存该助手。 [native](native/results.json)|
|[AG-12](../demo-v2-baseline/02-成员与执行.md#ag-12) A 在个人区启用端，建“个人复验员”，再用同名 Pi 助手保存一次|已记录所列条件|sameNameRejected=True、matchingAgents=1 [macos](macos/agents.json)|
|[AG-10](../demo-v2-baseline/02-成员与执行.md#ag-10) 团队目录焦点置于 tab，按左右/Home/End，再切个人区|已记录所列条件|B 团队智能体目录按 End、Home。焦点与选中 tab 同步切换。 [native](native/results.json)|
|[AG-11](../demo-v2-baseline/02-成员与执行.md#ag-11) A 对自己管理的非系统助手点“删除智能体”|已记录所列条件|cancelPreserved=True、confirmArchived=True、archivedDatabaseRows=1 [macos](macos/agents.json)<br>A 打开共享助手的删除确认并取消。确认包含名称，取消后助手仍在。 [native](native/results.json)|
|[PRB-01](../demo-v2-baseline/02-成员与执行.md#prb-01) 所有者点行内“测试模型调用”|已记录所列条件|provider=codex、executor=fixture-codex、result=模型调用通过、repeat=模型调用通过 [macos](macos/agents.json)<br>otherClient=b、queueResult=cancelled、owner=native_1795671410 [macos](macos/agents.json)<br>D-08 暂缓 真实供应商调用。|
|[PRB-02](../demo-v2-baseline/02-成员与执行.md#prb-02) 在可调用端启动一次探测，分别观察等待/取消/完成/再次测试|已记录所列条件|provider=codex、executor=fixture-codex、result=模型调用通过、repeat=模型调用通过 [macos](macos/agents.json)<br>otherClient=b、queueResult=cancelled、owner=native_1795671410 [macos](macos/agents.json)<br>D-08 暂缓 真实模型完成和远程探测。|
|[PRB-03](../demo-v2-baseline/02-成员与执行.md#prb-03) 本机对应提供方或授权失败，打开行内更多操作→模型设置、直接授权入口或运行失败诊断中的模型设置|已记录所列条件|model=Codex、nativeDialog=取消导入 [macos](macos/agents.json)<br>D-08 暂缓 使用真实供应商身份进行认证。|
|[SQ-01](../demo-v2-baseline/02-成员与执行.md#sq-01) 从个人或团队侧栏进“智能体小队”，当前区没有小队|已记录所列条件|创建清单小队并选择共享助手为队长。小队名称和队长可见。 [native](native/results.json) [图](native/24-squad.png)|
|[SQ-02](../demo-v2-baseline/02-成员与执行.md#sq-02) A 在团队创建“清单小队”，选复验助手为队长|已记录所列条件|创建清单小队并选择共享助手为队长。小队名称和队长可见。 [native](native/results.json) [图](native/24-squad.png)|
|[SQ-03](../demo-v2-baseline/02-成员与执行.md#sq-03) 创建成功看详情，再从卡片进一次|已记录所列条件|创建清单小队并选择共享助手为队长。小队名称和队长可见。 [native](native/results.json) [图](native/24-squad.png)|
|[SQ-04](../demo-v2-baseline/02-成员与执行.md#sq-04) 管理者点编辑小队或小队指令旁“编辑”|已记录所列条件|打开小队编辑及成员角色表单后取消。预填原小队名称和角色说明，取消后仍在原详情。 [native](native/results.json)|
|[SQ-05](../demo-v2-baseline/02-成员与执行.md#sq-05) A 在详情“添加成员”选择 baseline_b，填“检查清单”，保存|已记录所列条件|A 将 B 加入小队后，B 打开详情。B 可见本人的角色说明。 [native](native/results.json)|
|[SQ-06](../demo-v2-baseline/02-成员与执行.md#sq-06) 对已有成员点“角色说明”|已记录所列条件|A 将 B 加入小队后，B 打开详情。B 可见本人的角色说明。 [native](native/results.json)<br>打开小队编辑及成员角色表单后取消。预填原小队名称和角色说明，取消后仍在原详情。 [native](native/results.json)|
|[SQ-07](../demo-v2-baseline/02-成员与执行.md#sq-07) 对非队长点移除，核对取消/确认|已记录所列条件|A 先取消再确认移出非队长 B，随后归档本轮小队。成员角色从详情移除，数据库有归档时间，B 新列表不再显示该队。 [native](native/results.json)|
|[SQ-08](../demo-v2-baseline/02-成员与执行.md#sq-08) A 点详情归档图标|已记录所列条件|A 先取消再确认移出非队长 B，随后归档本轮小队。成员角色从详情移除，数据库有归档时间，B 新列表不再显示该队。 [native](native/results.json)|

## 03-任务与协作

|编号与条件|实施和证据判定|迁移版实际观察及复验材料|
|---|---|---|
|[TL-01](../demo-v2-baseline/03-任务与协作.md#tl-01) 空区点任务；有数据后在同位置打开|已记录所列条件|B 在我负责/我创建之间切换并搜索无匹配内容。由 A 所创的任务仅出现在 B 的负责范围，重置恢复列表。 [native](native/results.json)|
|[TL-02](../demo-v2-baseline/03-任务与协作.md#tl-02) 切“我负责的”→“我创建的”，输入标题片段，逐次选所属项目、状态、负责人|已记录所列条件|B 在我负责/我创建之间切换并搜索无匹配内容。由 A 所创的任务仅出现在 B 的负责范围，重置恢复列表。 [native](native/results.json)|
|[TL-03](../demo-v2-baseline/03-任务与协作.md#tl-03) 选排序维度、方向，点前后页|已批准变更|重置搜索再切看板。筛选重置后留在任务页，切换为看板。 [native](native/results.json) [图](native/29-board.png)|
|[TL-04](../demo-v2-baseline/03-任务与协作.md#tl-04) 点看板视图、开卡片、返回任务列表；刷新、再从侧栏重新进任务|已记录所列条件|重置搜索再切看板。筛选重置后留在任务页，切换为看板。 [native](native/results.json) [图](native/29-board.png)|
|[TL-05](../demo-v2-baseline/03-任务与协作.md#tl-05) A 进入“分页复验”的 102 件任务，按默认排序连翻两页，再搜“分页种子”|已记录所列条件|新团队 102 行样本翻三页，再搜索。每页 50、50、2 件，末页下一页禁用，搜索回到唯一种子。 [native](native/results.json)|
|[TK-01](../demo-v2-baseline/03-任务与协作.md#tk-01) 从列表右上打开新建|已记录所列条件|团队任务列表新建普通任务。标题为空，创建按钮禁用。 [native](native/results.json) [图](native/11-task-new.png)|
|[TK-02](../demo-v2-baseline/03-任务与协作.md#tk-02) 检查默认值、逐个填字段|已记录所列条件|A 创建任务、要求、文本附件并指派 B。落在新任务详情，持久化业务状态 backlog，执行 0 条。 [native](native/results.json) [图](native/13-task-detail.png)|
|[TK-03](../demo-v2-baseline/03-任务与协作.md#tk-03) 填标题后 Esc 或叉号关闭，再开|已记录所列条件|新任务写标题后按 Esc 再开。表单重置。 [native](native/results.json)|
|[TK-04](../demo-v2-baseline/03-任务与协作.md#tk-04) A 选负责人 B，输入标题“核对交接清单”和要求，选 baseline.txt|已记录所列条件|上传输入文件，尚未提交任务。附件显示待发送，创建按钮可用。 [native](native/results.json)|
|[TK-05](../demo-v2-baseline/03-任务与协作.md#tk-05) 点“创建任务”，在 A、B 各观察|已记录所列条件|A 创建任务、要求、文本附件并指派 B。落在新任务详情，持久化业务状态 backlog，执行 0 条。 [native](native/results.json) [图](native/13-task-detail.png)|
|[TK-06](../demo-v2-baseline/03-任务与协作.md#tk-06) 对正常提交连按，或让网络在成功写入后丢失回包再重试|已记录所列条件|仅丢弃实际写入成功的首个创建响应，保留表单后关闭、刷新列表。表单显示未完成并保留标题；恢复读取见一条任务，未自动重送。手动再次提交是独立写入。 [native](native/results.json)|
|[TK-07](../demo-v2-baseline/03-任务与协作.md#tk-07) 有描述时切“智能体起草”，再切回|已记录所列条件|切换智能体起草模式。起草表单可达，未提交模型请求。 [native](native/results.json) [图](native/12-task-draft.png)<br>离线提交失败；在本轮专有 runtime 上短时设置在线心跳，以可控数据库回填模拟处理结果。真实起草请求由 B 创建、重试产生另一个请求 ID。界面随排队、运行、取消、成功轮询更新，结果可核对；改负责人撤销确认。 [native](native/results.json)|
|[TK-08](../demo-v2-baseline/03-任务与协作.md#tk-08) 有授权在线助手时生成草稿、等待、失败或重新生成|已记录所列条件|离线提交失败；在本轮专有 runtime 上短时设置在线心跳，以可控数据库回填模拟处理结果。真实起草请求由 B 创建、重试产生另一个请求 ID。界面随排队、运行、取消、成功轮询更新，结果可核对；改负责人撤销确认。 [native](native/results.json)<br>D-08 暂缓 真实模型草拟质量。|
|[TK-09](../demo-v2-baseline/03-任务与协作.md#tk-09) 从已确认结论的“创建后续任务”进入|已记录所列条件|A 使用结论创建后续任务并关闭话题；B 尝试重开。任务附结论且仅写一次，关联弹窗需选目标；普通成员请求得到 403 并留在话题。 [projects-workbench](projects-workbench/results.json)|
|[TK-10](../demo-v2-baseline/03-任务与协作.md#tk-10) 从项目任务页“组织到蓝图”或直接从施工蓝图编辑、预览发布|已记录所列条件|A 带 V1 结论入图，新增未指派节点并发布。草案和预览无任务，发布后仅一条任务。推进弹窗阻止未指派节点。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/23-start-preview.png)|
|[TD-01](../demo-v2-baseline/03-任务与协作.md#td-01) B 从分派通知打开任务|已记录所列条件|双方打开同一已分派任务，A 切换关注后恢复。本人关注操作可逆，B 重载仍保持其本人原订阅。 [native](native/results.json)|
|[TD-02](../demo-v2-baseline/03-任务与协作.md#td-02) 切关注/取消关注；有新回复时点“有新回复，点击查看”|已记录所列条件|双方打开同一已分派任务，A 切换关注后恢复。本人关注操作可逆，B 重载仍保持其本人原订阅。 [native](native/results.json)|
|[TD-03](../demo-v2-baseline/03-任务与协作.md#td-03) 编辑任务要求|已记录所列条件|A 编辑任务要求，空标题、取消、重新打开再保存。保留原值且空标题禁保存，B 同一任务自动更新。 [native](native/results.json)|
|[TD-04](../demo-v2-baseline/03-任务与协作.md#td-04) B 把分给自己的待规划任务改为已完成|已记录所列条件|保存已完成后写一条未发评论并刷新。回到同一任务，材料与已发评论仍在，未发送输入清空，数据库 done 且无执行。 [native](native/results.json) [图](native/16-task-after-reload.png)|
|[RUN-01](../demo-v2-baseline/03-任务与协作.md#run-01) B 从新建任务把“离线分派”交给 A 的共享助手，保持待规划|已记录所列条件|B 给离线共享助手建待规划任务再改进行中。创建时无执行；推进前显示确认框。 [native](native/results.json) [图](native/33-trigger-preview.png)|
|[RUN-02](../demo-v2-baseline/03-任务与协作.md#run-02) B 对离线助手选“确认并开始”|已记录所列条件|B 确认离线分派。任务进行中、执行排队中、尚未领取。 [native](native/results.json) [图](native/34-offline-dispatch.png)|
|[RUN-03](../demo-v2-baseline/03-任务与协作.md#run-03) 同样条件另建“暂不启动”，改进行中选“暂不开始”|已记录所列条件|B 重试并取消原执行，再为另一件选暂不开始。首件有两个未领取的取消执行，第二件进行中且执行数 0。 [native](native/results.json)|
|[RUN-04](../demo-v2-baseline/03-任务与协作.md#run-04) B 对排队项打开详情、展开日志，然后停止|已记录所列条件|查看执行详情后停止。执行取消，业务状态仍进行中，提供重试。 [native](native/results.json) [图](native/35-cancel-run.png)|
|[RUN-05](../demo-v2-baseline/03-任务与协作.md#run-05) B 点取消项“重试”|已记录所列条件|B 重试并取消原执行，再为另一件选暂不开始。首件有两个未领取的取消执行，第二件进行中且执行数 0。 [native](native/results.json)|
|[RUN-06](../demo-v2-baseline/03-任务与协作.md#run-06) 已分派、端在线、模型授权有效后推进；等待执行结束|已记录所列条件|B 分派给 A 的在线 Codex 协议夹具并确认开始。Multica 持久记录开始/结束、责任人 B 与执行终态，B 在任务详情读到 WORKBENCH_FIXTURE_OK。 [native](native/results.json)<br>D-08 暂缓 真实 CLI 模型领取、完成与交付。|
|[RUN-07](../demo-v2-baseline/03-任务与协作.md#run-07) 打开多条执行历史、失败详情、模型设置或交付链接|已记录所列条件|助手所属人 A 打开 B 发起的执行任务。A 可见业务任务，无 B 的私有停止操作。 [native](native/results.json)<br>查看执行详情后停止。执行取消，业务状态仍进行中，提供重试。 [native](native/results.json) [图](native/35-cancel-run.png)|
|[RUN-08](../demo-v2-baseline/03-任务与协作.md#run-08) @小队后有队长评估，或查看项目任务的后继|已记录所列条件|正式 V3 发布一条依赖，项目任务页打开上游并置为完成。详情显示返回项目，交接弹窗只列直接后继‘汇总交付’，关闭后可回项目。 [projects-workbench](projects-workbench/results.json)|
|[CM-01](../demo-v2-baseline/03-任务与协作.md#cm-01) B 在详情直接输入“两项约定已核对”，点发送|已记录所列条件|B 评论后 A 查看附件。A 不刷新即可见 B 评论，打开输入材料可读完整原文。 [native](native/results.json) [图](native/15-file-preview.png)|
|[CM-02](../demo-v2-baseline/03-任务与协作.md#cm-02) 点某评论“回复”，点引用、取消回复、发子回复|已记录所列条件|取消回复再回复同一评论并点击子回复的引用。引用返回父评论 comment-bc46cdfc-5484-4d07-a628-06daf0ef55f9，焦点与旧回复相符。 [native](native/results.json)|
|[CM-03](../demo-v2-baseline/03-任务与协作.md#cm-03) “提及成员或智能体”或正文以 @ 结尾，用方向键/回车选候选；Esc|已记录所列条件|A 提及 B，B 留未读时退出前取样。B 看到提及事件，服务端未读事件数 2。 [native](native/results.json) [图](native/36-before-restart.png)|
|[CM-04](../demo-v2-baseline/03-任务与协作.md#cm-04) @助手或小队，有预估触发项|已记录所列条件|B 提及助手，取消勾选预估中的触发项再发送。评论成功入库，该任务没有产生执行。 [native](native/results.json)|
|[FL-01](../demo-v2-baseline/03-任务与协作.md#fl-01) 选多个附件，仅部分上传成功|已批准变更|新建任务仅上传失败，恢复连接后移除。失败附件允许移除，普通任务仍可编辑。 [native](native/results.json)<br>新建任务仅上传失败，恢复连接后取消。失败附件允许取消，普通任务仍可编辑。 [native](native/results.json)<br>新建任务仅上传失败，恢复连接后重试。失败附件允许重试，普通任务仍可编辑。 [native](native/results.json)|
|[FL-02](../demo-v2-baseline/03-任务与协作.md#fl-02) 点输入材料 baseline.txt|已记录所列条件|B 评论后 A 查看附件。A 不刷新即可见 B 评论，打开输入材料可读完整原文。 [native](native/results.json) [图](native/15-file-preview.png)|
|[FL-03](../demo-v2-baseline/03-任务与协作.md#fl-03) 在评论发文件后查右侧产物；同产物多版本时展开历史|已记录所列条件|B 两次交付同名同 MIME 的 review.txt。最新版本单列，历史折叠显示 1 份。 [native](native/results.json) [图](native/39-delivery.png)|
|[FL-04](../demo-v2-baseline/03-任务与协作.md#fl-04) B 回复并附 review.txt（first）|已记录所列条件|B 两次交付同名同 MIME 的 review.txt。最新版本单列，历史折叠显示 1 份。 [native](native/results.json) [图](native/39-delivery.png)|
|[FL-05](../demo-v2-baseline/03-任务与协作.md#fl-05) B 再交同名同 MIME 的 review.txt（second）|已记录所列条件|B 两次交付同名同 MIME 的 review.txt。最新版本单列，历史折叠显示 1 份。 [native](native/results.json) [图](native/39-delivery.png)|
|[FL-06](../demo-v2-baseline/03-任务与协作.md#fl-06) 展开早期版本点 v1 的“定位到协作记录”|已记录所列条件|从已展开的早期版本定位评论。焦点进入旧评论 comment-3f14ff8e-9289-4d63-a220-adc04325f5c3 [native](native/results.json)|
|[CM-05](../demo-v2-baseline/03-任务与协作.md#cm-05) 打开含协调活动的“查看原始协调说明”及活动中“展开诊断信息”|已记录所列条件|为本轮任务安装一条协调活动，再在详情展开/收起原文。能够阅读完整协调原因，收起后保留活动摘要。 [native](native/results.json)|
|[IB-01](../demo-v2-baseline/03-任务与协作.md#ib-01) B 收到任务分派，A 收到回复和状态变化|已记录所列条件|B 访问自己的团队收件箱。看到 A 新分派的任务。 [native](native/results.json) [图](native/14-member-inbox.png)<br>A 展开同任务的此前通知。同任务聚合，历史内有各事件的独立操作。 [native](native/results.json) [图](native/31-history.png)|
|[IB-02](../demo-v2-baseline/03-任务与协作.md#ib-02) 打开此前通知里的旧回复|已记录所列条件|A 展开同任务的此前通知。同任务聚合，历史内有各事件的独立操作。 [native](native/results.json) [图](native/31-history.png)<br>同任务先后两次提及，B 从两条历史事件分别打开再刷新。两条不同 comment_id 分别写入路由，键盘焦点与数据库中对应原文的评论 ID 一致。 [native](native/results.json)|
|[IB-03](../demo-v2-baseline/03-任务与协作.md#ib-03) 对单条切已读/未读；B 点归档，再到“已归档”恢复通知|已记录所列条件|归档通知，再从归档分区恢复。恢复后手动切回当前，任务可打开。 [native](native/results.json)|
|[IB-04](../demo-v2-baseline/03-任务与协作.md#ib-04) 退出重启、刷新、切工作区|已记录所列条件|A 提及 B，B 留未读时退出前取样。B 看到提及事件，服务端未读事件数 2。 [native](native/results.json) [图](native/36-before-restart.png)|

## 04-项目与蓝图

|编号与条件|实施和证据判定|迁移版实际观察及复验材料|
|---|---|---|
|[PJ-01](../demo-v2-baseline/04-项目与蓝图.md#pj-01) 打开侧栏项目，无项目点空态“新建项目”，有项目点右上同名按钮|已记录所列条件|空团队，A 新建项目，B 打开总览。首焦点、必填、取消重开、成功页和单条落库符合；A 有设置，普通成员 B 只能查看。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/18-project.png)|
|[PJ-02](../demo-v2-baseline/04-项目与蓝图.md#pj-02) A 创建后，B 从项目卡进入|已记录所列条件|空团队，A 新建项目，B 打开总览。首焦点、必填、取消重开、成功页和单条落库符合；A 有设置，普通成员 B 只能查看。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/18-project.png)|
|[PJ-03](../demo-v2-baseline/04-项目与蓝图.md#pj-03) 有权账号点项目设置|已记录所列条件|所有者打开项目设置。读回项目名和已有目标，Esc 关闭。 [projects-workbench](projects-workbench/results.json)|
|[PJ-04](../demo-v2-baseline/04-项目与蓝图.md#pj-04) 比较新项目总览与有任务/未解决话题的总览|已记录所列条件|空团队，A 新建项目，B 打开总览。首焦点、必填、取消重开、成功页和单条落库符合；A 有设置，普通成员 B 只能查看。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/18-project.png)|
|[PJ-05](../demo-v2-baseline/04-项目与蓝图.md#pj-05) 点项目的“任务”标签或概览任务行，再返回|已记录所列条件|正式 V3 发布一条依赖，项目任务页打开上游并置为完成。详情显示返回项目，交接弹窗只列直接后继‘汇总交付’，关闭后可回项目。 [projects-workbench](projects-workbench/results.json)|
|[TP-01](../demo-v2-baseline/04-项目与蓝图.md#tp-01) 点“讨论”“开始讨论”或“查看项目讨论”|已记录所列条件|A 创建话题、保存并重开结论草稿、确认。话题出现初始正文，空草稿不能确认，重开读到原文，确认后出现正式结论。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/19-conclusion.png)|
|[TP-02](../demo-v2-baseline/04-项目与蓝图.md#tp-02) 从左侧话题、未解决列表、收件箱话题或带 comment 的链接进入|已记录所列条件|A 创建话题、保存并重开结论草稿、确认。话题出现初始正文，空草稿不能确认，重开读到原文，确认后出现正式结论。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/19-conclusion.png)|
|[TP-03](../demo-v2-baseline/04-项目与蓝图.md#tp-03) 选“交付口径”，点“带此话题进入蓝图”|已记录所列条件|A 带 V1 结论入图，新增未指派节点并发布。草案和预览无任务，发布后仅一条任务。推进弹窗阻止未指派节点。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/23-start-preview.png)|
|[TP-04](../demo-v2-baseline/04-项目与蓝图.md#tp-04) 有结论的话题点“关闭话题”；再重新打开|已记录所列条件|A 使用结论创建后续任务并关闭话题；B 尝试重开。任务附结论且仅写一次，关联弹窗需选目标；普通成员请求得到 403 并留在话题。 [projects-workbench](projects-workbench/results.json)|
|[PJ-06](../demo-v2-baseline/04-项目与蓝图.md#pj-06) 非项目负责人 B 从项目卡进 A 的项目|已记录所列条件|空团队，A 新建项目，B 打开总览。首焦点、必填、取消重开、成功页和单条落库符合；A 有设置，普通成员 B 只能查看。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/18-project.png)|
|[TP-05](../demo-v2-baseline/04-项目与蓝图.md#tp-05) B 点击 A 已关闭话题的“重新打开”|已记录所列条件|A 使用结论创建后续任务并关闭话题；B 尝试重开。任务附结论且仅写一次，关联弹窗需选目标；普通成员请求得到 403 并留在话题。 [projects-workbench](projects-workbench/results.json)|
|[TC-01](../demo-v2-baseline/04-项目与蓝图.md#tc-01) 点“整理结论”|已记录所列条件|A 创建话题、保存并重开结论草稿、确认。话题出现初始正文，空草稿不能确认，重开读到原文，确认后出现正式结论。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/19-conclusion.png)|
|[TC-02](../demo-v2-baseline/04-项目与蓝图.md#tc-02) 输入“按清单验收”点“保留草稿”，再次整理|已记录所列条件|A 创建话题、保存并重开结论草稿、确认。话题出现初始正文，空草稿不能确认，重开读到原文，确认后出现正式结论。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/19-conclusion.png)|
|[TC-03](../demo-v2-baseline/04-项目与蓝图.md#tc-03) 编辑草稿，点“确认结论”|已记录所列条件|A 创建话题、保存并重开结论草稿、确认。话题出现初始正文，空草稿不能确认，重开读到原文，确认后出现正式结论。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/19-conclusion.png)|
|[TC-04](../demo-v2-baseline/04-项目与蓝图.md#tc-04) 已有确认后再有新讨论，或修改旧草稿|已记录所列条件|话题已确认 V2，查询按 V1 创建的后续任务。任务继续引用 V1 与当时的结论原文。 [projects-workbench](projects-workbench/results.json)|
|[TC-05](../demo-v2-baseline/04-项目与蓝图.md#tc-05) 展开“用 AI 起草结论”，选择个体助手，申请、取消、查看或插入草稿|已记录所列条件|本地排队后取消，重新生成；本机受控结果插入可编辑正文后保留草稿。重开后可编辑正文完整；确认版本仍为 0，话题仍开放。 [planning](planning/results.json) [图](planning/conclusion-inserted.png)<br>D-08 暂缓 真实生成的结论质量。|
|[TC-08](../demo-v2-baseline/04-项目与蓝图.md#tc-08) 已确认 V1，点“创建后续任务”|已记录所列条件|A 使用结论创建后续任务并关闭话题；B 尝试重开。任务附结论且仅写一次，关联弹窗需选目标；普通成员请求得到 403 并留在话题。 [projects-workbench](projects-workbench/results.json)|
|[TC-09](../demo-v2-baseline/04-项目与蓝图.md#tc-09) 填“处理已确认结论”提交|已记录所列条件|A 使用结论创建后续任务并关闭话题；B 尝试重开。任务附结论且仅写一次，关联弹窗需选目标；普通成员请求得到 403 并留在话题。 [projects-workbench](projects-workbench/results.json)|
|[TC-10](../demo-v2-baseline/04-项目与蓝图.md#tc-10) 点“关联已有任务承接”|已记录所列条件|A 使用结论创建后续任务并关闭话题；B 尝试重开。任务附结论且仅写一次，关联弹窗需选目标；普通成员请求得到 403 并留在话题。 [projects-workbench](projects-workbench/results.json)|
|[TC-11](../demo-v2-baseline/04-项目与蓝图.md#tc-11) 展开“项目安排与其他处理”选纳入蓝图|已记录所列条件|A 使用结论创建后续任务并关闭话题；B 尝试重开。任务附结论且仅写一次，关联弹窗需选目标；普通成员请求得到 403 并留在话题。 [projects-workbench](projects-workbench/results.json)|
|[TC-12](../demo-v2-baseline/04-项目与蓝图.md#tc-12) 在同处选仅记录类处理，填写说明并保存|已记录所列条件|已确认的 V1 选择仅记录。返回同一话题，V1 历史项内可以展开查看说明。 [projects-workbench](projects-workbench/results.json)|
|[BP-01](../demo-v2-baseline/04-项目与蓝图.md#bp-01) 首次从项目打开“施工蓝图”|已记录所列条件|A 带 V1 结论入图，新增未指派节点并发布。草案和预览无任务，发布后仅一条任务。推进弹窗阻止未指派节点。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/23-start-preview.png)|
|[BP-02](../demo-v2-baseline/04-项目与蓝图.md#bp-02) 点击编辑草案/从正式版编辑，再返回当前版|已记录所列条件|A 带 V1 结论入图，新增未指派节点并发布。草案和预览无任务，发布后仅一条任务。推进弹窗阻止未指派节点。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/23-start-preview.png)|
|[BP-03](../demo-v2-baseline/04-项目与蓝图.md#bp-03) 新增任务后改右栏标题、交付要求、负责人、日期|已记录所列条件|A 带 V1 结论入图，新增未指派节点并发布。草案和预览无任务，发布后仅一条任务。推进弹窗阻止未指派节点。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/23-start-preview.png)|
|[BP-04](../demo-v2-baseline/04-项目与蓝图.md#bp-04) 点已有节点、找任务下拉、缩放、适应、拖动节点或拖画布|已记录所列条件|定位既有节点并将负责人改为 B；打开 AI 输入预览。定位与右栏联动，预览明确指出未纳入话题。未申请模型执行。 [projects-workbench](projects-workbench/results.json)|
|[BP-05](../demo-v2-baseline/04-项目与蓝图.md#bp-05) 编辑→加入已有任务，搜索，点候选|已记录所列条件|在 V2 草案纳入已有任务，编辑依赖，移出并同步。搜索选入，边可编辑、删除；本例撤销删除未恢复边，冻结版独立复验同样。取消移出保留节点，确认后真实任务仍只有一条。同步没有发布新版本。 [projects-workbench](projects-workbench/results.json)|
|[BP-06](../demo-v2-baseline/04-项目与蓝图.md#bp-06) 先选上游“连接下游任务”后选另一节点，或右栏添加前置任务|已记录所列条件|在 V2 草案纳入已有任务，编辑依赖，移出并同步。搜索选入，边可编辑、删除；本例撤销删除未恢复边，冻结版独立复验同样。取消移出保留节点，确认后真实任务仍只有一条。同步没有发布新版本。 [projects-workbench](projects-workbench/results.json)|
|[BP-07](../demo-v2-baseline/04-项目与蓝图.md#bp-07) 选边→写交接说明、移除边；选节点→从图移出，取消/确认|已记录所列条件|在 V2 草案纳入已有任务，编辑依赖，移出并同步。搜索选入，边可编辑、删除；本例撤销删除未恢复边，冻结版独立复验同样。取消移出保留节点，确认后真实任务仍只有一条。同步没有发布新版本。 [projects-workbench](projects-workbench/results.json)|
|[BP-08](../demo-v2-baseline/04-项目与蓝图.md#bp-08) 拖动/编辑后点撤销、重做、自动布局；用键盘快捷键|已记录所列条件|在 V2 草案纳入已有任务，编辑依赖，移出并同步。搜索选入，边可编辑、删除；本例撤销删除未恢复边，冻结版独立复验同样。取消移出保留节点，确认后真实任务仍只有一条。同步没有发布新版本。 [projects-workbench](projects-workbench/results.json)<br>同一组动作、同一 Multica 构建、各自新团队。撤销删除后是否恢复连线为 False，重做后是否有连线为 False，两端相同。 [reference](reference/results.json)|
|[BP-09](../demo-v2-baseline/04-项目与蓝图.md#bp-09) 正式任务在别处被改，点“同步任务最新内容”|已记录所列条件|在 V2 草案纳入已有任务，编辑依赖，移出并同步。搜索选入，边可编辑、删除；本例撤销删除未恢复边，冻结版独立复验同样。取消移出保留节点，确认后真实任务仍只有一条。同步没有发布新版本。 [projects-workbench](projects-workbench/results.json)|
|[BP-10](../demo-v2-baseline/04-项目与蓝图.md#bp-10) 编辑、等约 700 ms 自动保存或点保存，退出再打开|已记录所列条件|定位既有节点并将负责人改为 B；打开 AI 输入预览。定位与右栏联动，预览明确指出未纳入话题。未申请模型执行。 [projects-workbench](projects-workbench/results.json)|
|[BP-11](../demo-v2-baseline/04-项目与蓝图.md#bp-11) A/B 改同一草案；另一人抢先发布后再保存|已记录所列条件|同一 revision，先存 A，再放行 B。未选择时不能合并，Esc 保留弹窗；选 B 的要求后 A 刷新读回相同草案。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/40-blueprint-conflict.png)|
|[BP-12](../demo-v2-baseline/04-项目与蓝图.md#bp-12) 从草案点“查看变更并发布”|已记录所列条件|A 带 V1 结论入图，新增未指派节点并发布。草案和预览无任务，发布后仅一条任务。推进弹窗阻止未指派节点。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/23-start-preview.png)|
|[BP-13](../demo-v2-baseline/04-项目与蓝图.md#bp-13) A 点“发布 V1”|已记录所列条件|A 带 V1 结论入图，新增未指派节点并发布。草案和预览无任务，发布后仅一条任务。推进弹窗阻止未指派节点。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/23-start-preview.png)|
|[BP-14](../demo-v2-baseline/04-项目与蓝图.md#bp-14) 普通成员 B 从已生效 V2 选择编辑草案|已记录所列条件|普通成员 B 进入已发布项目的编辑草案。B 可编辑任务要求，无发布控件。 [projects-workbench](projects-workbench/results.json)|
|[BP-15](../demo-v2-baseline/04-项目与蓝图.md#bp-15) A、B 在同一 revision 的“核对交付”节点分别输入不同交付要求；延迟 B 的原版保存，使 A 先成功|已记录所列条件|同一 revision，先存 A，再放行 B。未选择时不能合并，Esc 保留弹窗；选 B 的要求后 A 刷新读回相同草案。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/40-blueprint-conflict.png)|
|[BP-16](../demo-v2-baseline/04-项目与蓝图.md#bp-16) B 勾自己的版本，再点合并并保存，等草案稳定；A 刷新项目再选同节点|已记录所列条件|同一 revision，先存 A，再放行 B。未选择时不能合并，Esc 保留弹窗；选 B 的要求后 A 刷新读回相同草案。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/40-blueprint-conflict.png)|
|[BP-17](../demo-v2-baseline/04-项目与蓝图.md#bp-17) 点版本历史、查看某版本，再回当前版|已记录所列条件|两个正式版和一个更新草案。版本历史中可查看早先发布的版本。 [projects-workbench](projects-workbench/results.json)|
|[PL-01](../demo-v2-baseline/04-项目与蓝图.md#pl-01) 编辑草案→“用 AI 调整蓝图”|已记录所列条件|定位既有节点并将负责人改为 B；打开 AI 输入预览。定位与右栏联动，预览明确指出未纳入话题。未申请模型执行。 [projects-workbench](projects-workbench/results.json)|
|[PL-02](../demo-v2-baseline/04-项目与蓝图.md#pl-02) 带来源话题打开→勾确认归属→查看本次发送的输入|已记录所列条件|改动已预览的输入；请求排队、测试端领取后 A 取消。改输入使生成按钮失效。重新预览后产生带 revision、hash 及用户请求键的记录；UI 经等待、生成中至已取消，已取消请求的迟到回执被拒绝。 [planning](planning/results.json)<br>定位既有节点并将负责人改为 B；打开 AI 输入预览。定位与右栏联动，预览明确指出未纳入话题。未申请模型执行。 [projects-workbench](projects-workbench/results.json)|
|[PL-03](../demo-v2-baseline/04-项目与蓝图.md#pl-03) 在线有权助手，确认后“生成蓝图调整方案”|已记录所列条件|改动已预览的输入；请求排队、测试端领取后 A 取消。改输入使生成按钮失效。重新预览后产生带 revision、hash 及用户请求键的记录；UI 经等待、生成中至已取消，已取消请求的迟到回执被拒绝。 [planning](planning/results.json)<br>执行端返回无效的结构化建议。显示生成失败及服务端原因“建议格式不支持或超过 100 项变更”，草案未变。 [planning](planning/results.json)<br>历史请求切换与旧草案 revision 重放。切换历史失败/成功项时返回各自结果。采用一项后界面提示建议已过时；用原 revision 采用另项被服务端拒绝 409，草案保持不变。 [planning](planning/results.json)<br>D-08 暂缓 真实生成规划建议。|
|[PL-04](../demo-v2-baseline/04-项目与蓝图.md#pl-04) 有已完成建议时勾选操作、预览采纳、应用草案|已记录所列条件|受控返回两项新增及一项依赖，仅选择依赖、改选任务、再预览并采纳一项。缺少端点的依赖被拒，草案未变。改选使预览失效。只采纳“交接校验”，B 读到同一草案；正式版、对应业务任务均为 0。 [planning](planning/results.json) [图](planning/adoption-preview.png)<br>历史请求切换与旧草案 revision 重放。切换历史失败/成功项时返回各自结果。采用一项后界面提示建议已过时；用原 revision 采用另项被服务端拒绝 409，草案保持不变。 [planning](planning/results.json)<br>D-08 暂缓 真实生成建议质量。|
|[ST-01](../demo-v2-baseline/04-项目与蓝图.md#st-01) A 点“查看可推进任务”，正式版 V1 的节点未指派|已记录所列条件|A 带 V1 结论入图，新增未指派节点并发布。草案和预览无任务，发布后仅一条任务。推进弹窗阻止未指派节点。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/23-start-preview.png)|
|[ST-02](../demo-v2-baseline/04-项目与蓝图.md#st-02) 用正式计划准备人类负责人、智能体负责人、未完成前置、已通知和正在执行的任务|已记录所列条件|A 推进 V2 正式版中的人类负责人任务。界面确认已通知，B 的收件箱读到该任务。 [projects-workbench](projects-workbench/results.json)|
|[ST-03](../demo-v2-baseline/04-项目与蓝图.md#st-03) 从任务详情的项目上下文点击推进后继|已记录所列条件|正式 V3 发布一条依赖，项目任务页打开上游并置为完成。详情显示返回项目，交接弹窗只列直接后继‘汇总交付’，关闭后可回项目。 [projects-workbench](projects-workbench/results.json)|

## 05-工作台与依据

|编号与条件|实施和证据判定|迁移版实际观察及复验材料|
|---|---|---|
|[WB-01](../demo-v2-baseline/05-工作台与依据.md#wb-01) 个人或团队初入首页|已记录所列条件|A/B 分别注册，先提交两次不同的密码。两端都提示密码不一致，改正后分别进入自己的个人工作台。 [native](native/results.json) [图](native/02-personal.png)|
|[WB-02](../demo-v2-baseline/05-工作台与依据.md#wb-02) 空区点推荐问题；已有至少一任务再进入首页|已记录所列条件|有任务的工作区点推荐问题。只预填问句，仍可编辑和发送。 [projects-workbench](projects-workbench/results.json)|
|[WB-03](../demo-v2-baseline/05-工作台与依据.md#wb-03) 点“新对话”，输入、Shift+Enter 换行；文本超过普通高度时展开/收起|已记录所列条件|同一窗口同一份资料从 A 退出并登录 B。B 能打开团队任务；A 的多行草稿、历史对话及固定视图均不可见。 [native](native/results.json)|
|[WB-04](../demo-v2-baseline/05-工作台与依据.md#wb-04) 点输入区“模型”下拉|已记录所列条件|A 用默认模型发送，模型端在本机保持连接；刷新后停止。本地端收到请求；刷新可恢复，停止后显示重新回答，私有消息落库 cancelled。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/26-stopped.png)|
|[WB-05](../demo-v2-baseline/05-工作台与依据.md#wb-05) 输入“本地停用演练”按 Enter|已记录所列条件|A 用默认模型发送，模型端在本机保持连接；刷新后停止。本地端收到请求；刷新可恢复，停止后显示重新回答，私有消息落库 cancelled。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/26-stopped.png)<br>D-08 暂缓 真实供应商回答。|
|[WB-06](../demo-v2-baseline/05-工作台与依据.md#wb-06) 回答仍运行时刷新，再点“停止”|已记录所列条件|A 用默认模型发送，模型端在本机保持连接；刷新后停止。本地端收到请求；刷新可恢复，停止后显示重新回答，私有消息落库 cancelled。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/26-stopped.png)<br>D-08 暂缓 真实生成中取消。|
|[WB-07](../demo-v2-baseline/05-工作台与依据.md#wb-07) 失败、有部分答案、已停止或服务中断时点“重新回答”|已记录所列条件|已有纯 Markdown 与部分失败的回答，包含失配的历史布局。Markdown 正常排版；链接、图片作受限文本。失败回答保留已核对的陈述，可重答且不能固定。 [projects-workbench](projects-workbench/results.json)<br>D-08 暂缓 真实模型重新生成。|
|[WB-08](../demo-v2-baseline/05-工作台与依据.md#wb-08) 点最近对话“复验已存回答”，用 B 比最近列表；另检同一深链|已记录所列条件|A 回答证据指向真实团队任务，B 打开相同私有会话链接。A 可查看生成时快照、跳回任务和原回答；B 有输入框，看不到 A 问答与最近项。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/27-evidence.png)|
|[WB-09](../demo-v2-baseline/05-工作台与依据.md#wb-09) 在已完成回答点“固定为我的视图”|已记录所列条件|同一窗口同一份资料从 A 退出并登录 B。B 能打开团队任务；A 的多行草稿、历史对话及固定视图均不可见。 [native](native/results.json)<br>A 固定旧版表格回答、继续调整、取消固定。按归属落库 1 条，B 无此视图；调整预填原意图；取消后历史会话仍在。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/28-pin.png)|
|[WB-10](../demo-v2-baseline/05-工作台与依据.md#wb-10) 选 fingerprint 已过时的固定视图，再按刷新|已记录所列条件|固定回答的快照指纹已过期。自动刷新时仍显示上次表格，刷新按钮锁定。 [projects-workbench](projects-workbench/results.json)|
|[WB-11](../demo-v2-baseline/05-工作台与依据.md#wb-11) 点“继续调整”，完成新的回答后比较另存与更新原固定视图|已记录所列条件|A 固定旧版表格回答、继续调整、取消固定。按归属落库 1 条，B 无此视图；调整预填原意图；取消后历史会话仍在。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/28-pin.png)|
|[WB-12](../demo-v2-baseline/05-工作台与依据.md#wb-12) 点“取消固定”|已记录所列条件|A 固定旧版表格回答、继续调整、取消固定。按归属落库 1 条，B 无此视图；调整预填原意图；取消后历史会话仍在。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/28-pin.png)|
|[WB-13](../demo-v2-baseline/05-工作台与依据.md#wb-13) 静态表点击带标题的依据→打开任务→返回这次回答|已记录所列条件|A 回答证据指向真实团队任务，B 打开相同私有会话链接。A 可查看生成时快照、跳回任务和原回答；B 有输入框，看不到 A 问答与最近项。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/27-evidence.png)|
|[WB-14](../demo-v2-baseline/05-工作台与依据.md#wb-14) 打开动态已完成“七项记录夹具”；搜“条目 7”，或点展开全部/收起|已记录所列条件|已完成的七项动态记录。默认六条；展开、筛选、清空、追问预填和依据展开均可操作。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/38-dynamic.png)|
|[WB-15](../demo-v2-baseline/05-工作台与依据.md#wb-15) 点击动态结论上的“查看依据 1”，再点击编号或实体名称|已记录所列条件|已完成的七项动态记录。默认六条；展开、筛选、清空、追问预填和依据展开均可操作。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/38-dynamic.png)|
|[WB-16](../demo-v2-baseline/05-工作台与依据.md#wb-16) 看不同类型依据、过期或不可访问记录|已记录所列条件|A 回答证据指向真实团队任务，B 打开相同私有会话链接。A 可查看生成时快照、跳回任务和原回答；B 有输入框，看不到 A 问答与最近项。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/27-evidence.png)|
|[WB-17](../demo-v2-baseline/05-工作台与依据.md#wb-17) 生成分布图、表格或旧版动态布局的回答|已记录所列条件|已存的分布回答，一组有统计，一组无记录。图表和明细双向切换；表格含已完成状态，空分组显示无统计记录。 [projects-workbench](projects-workbench/results.json)|
|[WB-18](../demo-v2-baseline/05-工作台与依据.md#wb-18) 动态 section 布局失败、已核对内容存在或只有纯 Markdown 回答|已记录所列条件|已有纯 Markdown 与部分失败的回答，包含失配的历史布局。Markdown 正常排版；链接、图片作受限文本。失败回答保留已核对的陈述，可重答且不能固定。 [projects-workbench](projects-workbench/results.json)|
|[WB-19](../demo-v2-baseline/05-工作台与依据.md#wb-19) 带 B 身份切团队/个人区、切回和真退出重开|已记录所列条件|同一窗口同一份资料从 A 退出并登录 B。B 能打开团队任务；A 的多行草稿、历史对话及固定视图均不可见。 [native](native/results.json)<br>A 回答证据指向真实团队任务，B 打开相同私有会话链接。A 可查看生成时快照、跳回任务和原回答；B 有输入框，看不到 A 问答与最近项。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/27-evidence.png)|
|[WB-20](../demo-v2-baseline/05-工作台与依据.md#wb-20) A 打开“复验已存回答”，把该 conversation 的完整地址用已登录的 B 直接打开|已记录所列条件|A 回答证据指向真实团队任务，B 打开相同私有会话链接。A 可查看生成时快照、跳回任务和原回答；B 有输入框，看不到 A 问答与最近项。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/27-evidence.png)|

## 06-已有用户与裁决

|编号与条件|实施和证据判定|迁移版实际观察及复验材料|
|---|---|---|
|[STATE-01](../demo-v2-baseline/06-已有用户与裁决.md#state-01) 同窗口刷新后仍保留 B 和当前 issue/看板 hash；原生红钮后进程仍在，激活时仍是原看板。真退出，确认原 PID 已消失，同资料重启显示账号/密码均空，再登录先个人区|已记录所列条件|redButton=hidden、samePid=True、sameInput=shell_check [macos](macos/shell.json)<br>newPid=True、emptyAccountAndPassword=True、image=32-cold-start.png [macos](macos/shell.json)<br>保存已完成后写一条未发评论并刷新。回到同一任务，材料与已发评论仍在，未发送输入清空，数据库 done 且无执行。 [native](native/results.json) [图](native/16-task-after-reload.png)<br>正常退出 B，再打开同一 bundle 与资料。原进程结束后重开显示空登录框。 [native](native/results.json) [图](native/32-cold-start.png)|
|[STATE-02](../demo-v2-baseline/06-已有用户与裁决.md#state-02) 换回团队，原任务编号、负责人、已完成状态、要求、评论仍在；个人区没有同一任务。发布的计划转成团队项目任务，A 的私有会话和固定视图仍属于 A|已记录所列条件|保存已完成后写一条未发评论并刷新。回到同一任务，材料与已发评论仍在，未发送输入清空，数据库 done 且无执行。 [native](native/results.json) [图](native/16-task-after-reload.png)|
|[STATE-03](../demo-v2-baseline/06-已有用户与裁决.md#state-03) B 在团队 new 输入“基线草稿”，Shift+Enter 再输 X；刷新仍两行，去个人区为空，回团队两行恢复。真退出后重登录、重选同一团队，原文仍在|已记录所列条件|同一窗口同一份资料从 A 退出并登录 B。B 能打开团队任务；A 的多行草稿、历史对话及固定视图均不可见。 [native](native/results.json)<br>同资料切回 A。原草稿和私人对象回来，排除因登出而被删除的误判。 [native](native/results.json)|
|[STATE-04](../demo-v2-baseline/06-已有用户与裁决.md#state-04) 列表新建任务，输入“暂存”，取消再开为空；详情评论未发送时刷新为空。新建工作区弹窗在同一外壳关闭后却保留两字段；结论点“保留草稿”再开有正文。蓝图自动保存和 sessionStorage 中的本机未保存稿分别处理|已记录所列条件|新任务写标题后按 Esc 再开。表单重置。 [native](native/results.json)<br>A 创建话题、保存并重开结论草稿、确认。话题出现初始正文，空草稿不能确认，重开读到原文，确认后出现正式结论。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/19-conclusion.png)|
|[STATE-05](../demo-v2-baseline/06-已有用户与裁决.md#state-05) 上传后未发送、已附任务输入、评论交付是三种状态。B 重新登录回“核对交接清单”仍能看到 baseline.txt；同名交付 review.txt 最新单列、历史可展开|已记录所列条件|保存已完成后写一条未发评论并刷新。回到同一任务，材料与已发评论仍在，未发送输入清空，数据库 done 且无执行。 [native](native/results.json) [图](native/16-task-after-reload.png)|
|[STATE-06](../demo-v2-baseline/06-已有用户与裁决.md#state-06) A 提及 B；B 冷启前收件箱红点 2、只见一组未读卡。B 正常退出并登录，在团队仍见未读及此前通知；归档/恢复/读状态只影响操作账号|已记录所列条件|A 提及 B，B 留未读时退出前取样。B 看到提及事件，服务端未读事件数 2。 [native](native/results.json) [图](native/36-before-restart.png)|
|[STATE-07](../demo-v2-baseline/06-已有用户与裁决.md#state-07) B 在 A 的共享端停用时排队。刷新能查看执行详情；队列存在时 B 真退出、重新登录切回团队，仍能看到“智能体排队中”和停止。停止后业务状态仍进行中。A 不能看到 B 的私有运行卡|已记录所列条件|B 确认离线分派。任务进行中、执行排队中、尚未领取。 [native](native/results.json) [图](native/34-offline-dispatch.png)<br>B 重开或刷新后回到离线任务。相同任务继续排队，停止操作仍可用。 [native](native/results.json) [图](native/37-queue-restart.png)<br>D-08 暂缓 真实外部 CLI 在途接续。|
|[STATE-08](../demo-v2-baseline/06-已有用户与裁决.md#state-08) 刷新原版页面后仍可停止本地等待中的回答；服务端重启对 running 消息记 interrupted，对 refreshing 视图记失败。后者需要重新刷新，历史回答和成功快照独立|已记录所列条件|A 用默认模型发送，模型端在本机保持连接；刷新后停止。本地端收到请求；刷新可恢复，停止后显示重新回答，私有消息落库 cancelled。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/26-stopped.png)|
|[STATE-09](../demo-v2-baseline/06-已有用户与裁决.md#state-09) B 切看板后刷新 URL 保留 taskView=board；换到团队顶层/冷启重登录时工作台重新作为入口。业务表单临时状态、路由筛选、原生窗口位置及关窗行为各有存储层|已记录所列条件|before=[1180, 810, 2]、larger=[1077, 739, 2.190890312194824]、restored=[1180, 810, 2] [macos](macos/shell.json)<br>刷新团队任务看板。保留看板路由。 [native](native/results.json)|
|[STATE-10](../demo-v2-baseline/06-已有用户与裁决.md#state-10) 原版 11/19 迁移两份 daemon 登记，16 条登记在线、5 个既有智能体绑定保持。本轮启/停的是合成账号自己的执行端；同工作区 B 用 A 授予的助手，B 看不到 A 的私有端列表|已记录所列条件|offlineOptions=4、sameRuntimeIdsAfterRestart=True [macos](macos/agents.json)|
|[D-01](../demo-v2-baseline/06-已有用户与裁决.md#d-01) 同一通用应用的两份原生资料，以及同一资料中 A→B→A 换号。|按裁决重建|url=http://127.0.0.1:19116/#/team、viewport={'width': 1180, 'height': 810, 'dpr': 2, 'language': 'en-US'} [macos](macos/shell.json)<br>同一窗口同一份资料从 A 退出并登录 B。B 能打开团队任务；A 的多行草稿、历史对话及固定视图均不可见。 [native](native/results.json)<br>同资料切回 A。原草稿和私人对象回来，排除因登出而被删除的误判。 [native](native/results.json)<br>A 回答证据指向真实团队任务，B 打开相同私有会话链接。A 可查看生成时快照、跳回任务和原回答；B 有输入框，看不到 A 问答与最近项。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/27-evidence.png)|
|[D-02](../demo-v2-baseline/06-已有用户与裁决.md#d-02) 使用新建账号、合成成员关系和重新登录重建现场。|按裁决重建|B 退出后用错误密码和正确密码依次登录。错误时停在登录页，正确密码回个人区。 [native](native/results.json)<br>B 接受后从个人区手动进入团队。B 见 A 而无邀请按钮，成员表回读 owner 与 member。 [native](native/results.json)|
|[D-03](../demo-v2-baseline/06-已有用户与裁决.md#d-03) 采用新对象编号，重建任务、讨论、正式计划和私人回答的归属及链接。|按裁决重建|A 展开同任务的此前通知。同任务聚合，历史内有各事件的独立操作。 [native](native/results.json) [图](native/31-history.png)<br>同任务先后两次提及，B 从两条历史事件分别打开再刷新。两条不同 comment_id 分别写入路由，键盘焦点与数据库中对应原文的评论 ID 一致。 [native](native/results.json)<br>A 使用结论创建后续任务并关闭话题；B 尝试重开。任务附结论且仅写一次，关联弹窗需选目标；普通成员请求得到 403 并留在话题。 [projects-workbench](projects-workbench/results.json)<br>A 回答证据指向真实团队任务，B 打开相同私有会话链接。A 可查看生成时快照、跳回任务和原回答；B 有输入框，看不到 A 问答与最近项。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/27-evidence.png)|
|[D-04](../demo-v2-baseline/06-已有用户与裁决.md#d-04) 用新账号写入工作台草稿、结论和蓝图草案后重进。|按裁决重建|同一窗口同一份资料从 A 退出并登录 B。B 能打开团队任务；A 的多行草稿、历史对话及固定视图均不可见。 [native](native/results.json)<br>同资料切回 A。原草稿和私人对象回来，排除因登出而被删除的误判。 [native](native/results.json)<br>新任务写标题后按 Esc 再开。表单重置。 [native](native/results.json)<br>A 创建话题、保存并重开结论草稿、确认。话题出现初始正文，空草稿不能确认，重开读到原文，确认后出现正式结论。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/19-conclusion.png)<br>同一 revision，先存 A，再放行 B。未选择时不能合并，Esc 保留弹窗；选 B 的要求后 A 刷新读回相同草案。 [projects-workbench](projects-workbench/results.json) [图](projects-workbench/40-blueprint-conflict.png)|
|[D-05](../demo-v2-baseline/06-已有用户与裁决.md#d-05) 新建同名交付，按任务、来源评论和顺序检查；合成账号生成未读通知。|按裁决重建|B 两次交付同名同 MIME 的 review.txt。最新版本单列，历史折叠显示 1 份。 [native](native/results.json) [图](native/39-delivery.png)<br>A 提及 B，B 留未读时退出前取样。B 看到提及事件，服务端未读事件数 2。 [native](native/results.json) [图](native/36-before-restart.png)|
|[D-06](../demo-v2-baseline/06-已有用户与裁决.md#d-06) 新登记本机端、助手和共享授权。独立受控运行，核对领取、回执和停止。|按裁决重建|B 分派给 A 的在线 Codex 协议夹具并确认开始。Multica 持久记录开始/结束、责任人 B 与执行终态，B 在任务详情读到 WORKBENCH_FIXTURE_OK。 [native](native/results.json)<br>providers=['claude', 'codex', 'opencode', 'pi']、runtimeBindings=['claude／4643bf38-9ffe-4e18-82f9-c55d82d8f48e／e77cd5bd-1106-4002-b0a7-bfbddea4eebf', 'codex／2354c1d0-0936-4e31-a6f6-bc12df9deb98／e77cd5bd-1106-4002-b0a7-bfbddea4eebf', 'opencode／7c934cfc-650b-4e6a-aec2-e7c5ef3f8504／e77cd5bd-1106-4002-b0a7-bfbddea4eebf', 'pi／4b0bb44c-f52e-4188-8c38-31808cb391e5／e77cd5bd-1106-4002-b0a7-bfbddea4eebf'] [macos](macos/agents.json)<br>停止 A 的受控执行端。启用动作恢复；后续离线任务仍可分派给共享助手。 [native](native/results.json)<br>查看执行详情后停止。执行取消，业务状态仍进行中，提供重试。 [native](native/results.json) [图](native/35-cancel-run.png)|
|[D-07](../demo-v2-baseline/06-已有用户与裁决.md#d-07) 重置后保留任务页；新任务附件失败可重试、移除或取消。|已批准变更|新建任务仅上传失败，恢复连接后移除。失败附件允许移除，普通任务仍可编辑。 [native](native/results.json)<br>新建任务仅上传失败，恢复连接后取消。失败附件允许取消，普通任务仍可编辑。 [native](native/results.json)<br>新建任务仅上传失败，恢复连接后重试。失败附件允许重试，普通任务仍可编辑。 [native](native/results.json)<br>重置搜索再切看板。筛选重置后留在任务页，切换为看板。 [native](native/results.json) [图](native/29-board.png)|
|[D-08](../demo-v2-baseline/06-已有用户与裁决.md#d-08) 真实付费生成、真实供应商凭据、外部 SSH 建连和重连暂缓。|外部条件暂缓|按裁决保留真实外部样本缺口。|
|[X-01](../demo-v2-baseline/06-已有用户与裁决.md#x-01) `electron/team-pilot.mjs` 是另一个试点主进程；恢复版用完整 main.mjs 全壳。MW 全功能首页、旧设置/侧栏切换监听挂在 app-root，冻结页只挂三条 team 路由|原版可达性边界|不用开发预览页或 Multica 网页补齐桌面功能。菜单中实际出现的按钮仍登记，点击效果按 OS 条目核对。|
|[X-02](../demo-v2-baseline/06-已有用户与裁决.md#x-02) `team/personal.tsx`、`useTeamDraft`、NewTask 的 source/suppliedDraft、摘录/原会话产物/改工作区/放弃草稿/已创建等待关联或 quickResult 兼容态|原版可达性边界|冻结入口全局 NewTask 和话题后续都不传 source。若旧数据出现“返回个人任务”，记录是否跳去未挂路由；未证明可以从当前应用开始摘录。|
|[X-03](../demo-v2-baseline/06-已有用户与裁决.md#x-03) `team-page.tsx` 的旧邀请卡只在 showInvitationNotifications=false，冻结三条 route 都传 true。零工作区欢迎卡存在，但新账号正常列举会自动建立个人区|原版可达性边界|不将代码存在等同默认入口；邀请核对账号 toast。缺 slug 与零工作区分开。|
|[X-04](../demo-v2-baseline/06-已有用户与裁决.md#x-04) `handler/workbench.go` 包含 guest 拒绝；冻结恢复库 member_role_check 仅允许 owner/admin/member。本轮为 B 准备 guest 夹具时数据库直接拒绝，随后已查验 B 仍是 member|原版可达性边界|无法通过正常工作区成员数据复验 guest。未加入团队的合法账号为非成员，不标为 guest。|
|[X-05](../demo-v2-baseline/06-已有用户与裁决.md#x-05) 项目资源、更多通用 Multica 管理 API、角色调整、独立全功能 Web 页和 provider 配置未发现从此页直达的管理表单；资源可作为回答依据展示。Windows 标题栏有条件源码|原版可达性边界|保留待核实，不能用 API 或迁移版功能反推冻结产品必须提供一个管理页。|
|[X-06](../demo-v2-baseline/06-已有用户与裁决.md#x-06) 历史报告存在不同 UI、早期模型或 rejected 的动态样例；较早云 warmup 镜像与本机 r5 不同；已知三条 typecheck 诊断|原版可达性边界|只接受同入口/同数据/同版条件的实测作视觉标尺；历史材料按 H 编号和日期限定。|
