# 冻结 Demo V2 迁移验收

在这台 Mac 的 Finder 中双击 [Team Workbench.app](<../../.local/v2-runtime/desktop/Team Workbench.app>)。应用从包内启动 PostgreSQL、Multica 和 DSH，首次进入中文密码登录页。A、B 使用同一份 Apple Silicon 应用。默认测试资料在本产品的 `.local/v2-runtime`，API、两份 Host 和数据库端口分别为 19015、19016／19017 和 54359。[打开 40 幅原版与迁移版对照](comparison.html) · [逐条查验收判据](matrix.md) · [核对交付构建](regression/build.json)

下方完整回放对应首轮构建 `7063024a`。构建、类型检查、5 项自动测试和整套浏览器回归均通过。浏览器实际完成 19 个业务阶段的 69 条检查、项目与工作台 22 条检查、装配与恢复 3 条检查。

当前双击版为 `684f79d7`。四条亲验反馈已批量优化并通过原生复验。此前构建 `34c92b4b` 接入 V2 的官方 DeepSeek Flash 配置，为两位亲验账号准备执行端配置，并核对 A、B 两端的模型可选与发送前状态。真实生成由用户触发。下方回放命令仍适用于隔离的夹具现场。[当前配置与亲验条件](../desktop-runtime.md#2026-11-26-本机亲验配置)

## 亲自验收

1. 用两个新账号分别注册 A 和 B，每个账号第一次进入个人工作区。用 A 在顶栏工作区旁点「＋」，试一次非法地址，再创建团队。在「成员与智能体」邀请 B。B 登录后接受邀请，客户端自动进入该团队。
2. 在同一个窗口中，A 留下一条私人工作台输入，退出后以 B 登录并进入同一团队，核对 B 的输入、最近对话和固定视图。切回 A 再检查私有输入。回放会为已完成的回答及固定视图准备样本。
3. A 保持在线，从产品目录运行 `scripts/local open b`，第二份资料也会打开同一应用。B 登录自己的账号。A 创建并分派任务，B 从收件箱打开、回复并交付两个同名文件。A 检查评论定位、交付版本，下载后核对内容。D-07 批准的两项变化分别是重置筛选后留在任务页，以及新建任务上传失败后可重试、移除或取消。
4. 在项目中建话题、整理结论、创建后续任务。打开施工蓝图，编辑草案、预览变更、发布，再选择可推进任务。AI 规划与结论草稿的自动回放还可检查等待、领取、取消、失败，以及仅采纳选中的一项后 B 读到的草案。
5. 在私人工作台检查输入、生成中与停止、回答依据、历史产物版本、动态表和固定视图。自动回放通过本机延时服务或受控结果复现这些状态。

## 亲验问题清单

用户已体验项目以外的功能，反馈与冻结版基本一致。下列四条在本批修改并完成原生复验。项目仍待用户亲验。 [本批复验](regression/experience.json)

### V2-UX-01 接受邀请后缺少进入团队的引导

| 项目 | 记录 |
| --- | --- |
| 状态 | 2026-11-26 在 `34c92b4b` 发现，已修复并通过隔离原生回放。 |
| 现场 | dog 创建「动物园」并邀请 bear。dog 在「动物园 · 团队工作区」看到两人。bear 在「我的工作区 · 个人工作区」的同名「成员与智能体」页只看到本人。 |
| 已核对 | 本地数据库的邀请已接受。「动物园」已有 dog（所有者）和 bear（成员）。迁移版接受邀请后进入 `/team`，该入口优先落个人区。冻结 V2 的 IN-04 同样要求受邀人从顶栏手动选入新团队。 [冻结基线](../demo-v2-baseline/01-启动与工作区.md#in-04) · [首轮双端回放](native/results.json) |
| 体验问题 | bear 接受邀请后仍在个人区，缺少明确的加入反馈和团队入口，容易把个人区的成员列表当成团队名单，以为邀请未生效。 |
| 用户建议 | 接受邀请成功后，自动切换到该邀请对应的团队工作区。随本批问题一起修改。 |
| 复验判据 | bear 在个人区点击「接受邀请」。成功后顶栏自动切为「动物园 · 团队工作区」，进入「成员与智能体」可看到 dog 和 bear。接受失败时留在当前工作区并提示错误。 |

### V2-UX-02 智能体行的「更多操作」移到最右侧

| 项目 | 记录 |
| --- | --- |
| 状态 | 2026-11-26 在 `34c92b4b` 提出，已调整并通过视觉顺序与 Tab 顺序检查。 |
| 现场与基线 | 本机 Pi 智能体行从左到右依次为「测试模型调用」「更多操作（…）」「编辑智能体」「删除智能体」。迁移版与冻结 V2 的组件顺序一致，「更多操作」目前跟在模型测试入口后。 [冻结基线](../demo-v2-baseline/02-成员与执行.md#prb-03) |
| 修复与复验 | 将「更多操作」放在行尾，有「删除智能体」时紧跟在其右侧。视觉顺序和 Tab 顺序均为「测试模型调用 → 编辑智能体 → 删除智能体 → 更多操作」。展开「更多操作」仍可进入「模型设置」。 |

### V2-UX-03 Codex 模型选择器未说明目录来源

| 项目 | 记录 |
| --- | --- |
| 状态 | 2026-11-26 在 `34c92b4b` 发现，已通过隔离原生的授权前后和刷新失败复验。 |
| 现场 | dog 在「动物园」选中在线的本机 Codex 执行端。工作台下拉的前三项为 GPT-6 Astra、GPT-6.1 Sol、GPT-6 Sol，Codex 桌面端截图则显示 GPT-6.2 Sol、GPT-6.2 Astra、GPT-6.1 Terra 等。 |
| 已核对 | dog 当前这条执行端登记为 `codex-cli 0.163.0`，独立授权目录未登录、没有模型缓存。在干净资料中以相同版本运行 `codex debug models`，可见列表与 `--bundled` 的 8 项一致，前三项顺序复现截图。与本机 Codex 缓存的可见列表比较，上述三个型号确实缺失。迁移版选择器与冻结 V2 源码一致，无数量截断。 [冻结基线 AG-05](../demo-v2-baseline/02-成员与执行.md#ag-05) |
| 修复与复验 | 未授权时给出认证入口并标明内置或备用目录。授权变化后，模型发现跳过客户端旧结果、服务端快照和 daemon 内存缓存。刷新失败保留同一次授权下的旧结果。原生夹具实际验证了自动发现、失败保留、恢复及搜索保存。真实目录仍取决于所选 CLI 和授权。 [OpenAI 模型目录说明](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference#1-list-available-models) |

### V2-UX-04 Codex 认证弹窗误称共用本机登录

| 项目 | 记录 |
| --- | --- |
| 状态 | 2026-11-26 在 `34c92b4b` 发现，已修正文案并通过原生弹窗和受控探针复验。 |
| 现场 | dog 在「动物园」对「动物园园长」的 Codex 执行端测试 `gpt-6.1-sol`。执行端在线，截图显示测试未通过、认证缺失或不可用。下方仍提示「与本机其他 Codex 入口共用」。 |
| 已核对 | 该探针和认证面板均使用 dog 在当前客户端的独立 `CODEX_HOME`。首次失败时该目录有模型配置，未发现登录文件。本机通常使用的 Codex 资料中已有登录文件。弹窗沿用了冻结版的提示，迁移后的授权范围与文案不符。 [冻结基线 PRB-03](../demo-v2-baseline/02-成员与执行.md#prb-03) |
| 用户亲验 | 2026-11-26 14:52:06（北京时间），dog 在当前客户端完成独立 Codex 登录后，亲自重测「动物园园长」。界面显示 `gpt-6.1-sol`「模型调用通过」。该记录覆盖此账号和执行端的登录恢复及一次真实模型探针。 [冻结基线 PRB-02](../demo-v2-baseline/02-成员与执行.md#prb-02) |
| 修复与复验 | 认证状态和文案明确到当前账号、当前客户端的执行端。初次授权仍走 Codex 的登录入口。新版本在原生回放中复验了提示及受控模型探针。 |

在产品目录重放本批四条，脚本会打开已签名应用的两份隔离资料，使用合成账号和不发起外部模型调用的 CLI 夹具。

```sh
python3 tests/native/experience.py --output .local/replay-experience.json
```

## 实测范围

冻结基线含六章 **185 个操作、状态与条件**，其中 **146 个**有至少一项原版现场观察，另有 **8 项用户裁决**。390 条冻结控件定义中，371 条能定位到产品组件，19 条属于旧个人任务入口或 Windows 专属题头。一个编号常含多种角色、网络或生命周期条件，运行记录逐一写明实测的条件。[冻结覆盖及缺口](../demo-v2-baseline/coverage.md) · [控件映射](controls.md) · [裁决和 X-01～06](../demo-v2-baseline/06-已有用户与裁决.md)

| 想核对什么 | 记录 |
| --- | --- |
| 同机换号、双客户端协作与任务执行 | 原生回放登记 70 条检查及 27 张图，含账号归属、失败重试、另一成员所见、任务领取、结果和交付文件。查看表单错误或执行结果时可用基线编号定位。 [原生结果](native/results.json) · [双客户端回放](native-replay.md) |
| 项目、蓝图、并发和私人工作台 | 原生窗口另有 22 条检查及 13 张图，覆盖蓝图发布与推进、同字段冲突、动态答案、依据和固定视图。合计 40 幅按原版编号并排显示，均为 1180×810 CSS 像素、DPR 2。对照页保留双方原图，并按各图 ICC 转 sRGB 后统计差异。时间、合成身份、业务编号与模拟回答按实际语义核对。 [项目与工作台结果](projects-workbench/results.json) · [逐图对照](comparison.html) · [原版结构与业务结果](../demo-v2-baseline/evidence/index.md) |
| 规划与结论 | 5 条受控检查，含拒绝迟到结果、无效输出及过时 revision。选中建议只进入草案，结论可继续编辑。记录中有请求 ID、输入 hash、版本、B 的读回值及两张图。 [规划回放](planning/README.md) |
| 原型撤销 | 针对“删除连线→撤销→重做”，冻结页面和迁移页面使用各自的新团队，撤销后均未恢复这条线，重做后也均无此线。 [操作与原版结果](reference/results.json) |
| 构建、类型、浏览器及装配 | 按 `WorkbenchBuild` 核对构建输出和包内文件。浏览器使用独立资料复演业务流程；A7 依次省去执行端桥和收件箱，A8 检查服务恢复及测试会话过期。 [构建](regression/build.json) · [浏览器回归](regression/browser.json) · [装配与恢复](browser-assembly/results.json) · [组件、传输、依赖来源与许可](../renderer-migration.md) |
| 桌面壳与执行端 | Finder 无参数启动读取登录控件及包内进程来源。另有签名、原生菜单、关闭与重开、账号执行端及握手条件。 [Finder](macos/finder.json) · [打包](macos/packaging.json) · [系统菜单](macos/shell.json) · [智能体与探针](macos/agents.json) · [回环 SSH](macos/remote.json) · [本机运行说明](../desktop-runtime.md) |

**取证边界。** D-02～06 按裁决用新账号重建等价状态，旧库中既有账号、凭据、绑定和执行中的真实作业仍保留在原现场。冻结三条 team 路由未证实可从普通入口开始旧个人会话摘录、进入全量管理页或以 guest 角色加入团队。Windows 题头与 macOS 原生窗口条件不同。多分支编号中，撤权或删除后深链、若干跨成员冲突和设备恢复情况仍缺冻结等条件实录，详见各条的原版证据层级。D-08 暂缓真实付费模型与外部 SSH，回环协议、确定性 CLI 和预置结果分别按其测试条件解释。[原版尚缺条件](../demo-v2-baseline/coverage.md) · [逐条实际观察](matrix.md)

**仍有差异与待裁决项。** 在已重建、已实际操作的核心旅程中，本轮复验未留下新的阻断差异或需要新增的产品裁决。两项已批准的行为变化见 D-07。未取得等条件证据的分支与 D-08 继续保留在差异表中，最终体验由用户亲验。

**画面核对。** 登录页（01）和冷启登录页（32）的原版与交付版截图逐字节相同。蓝图冲突（40）在两侧都保留另一条待处理邀请，冲突弹窗内均须选定一个版本才能保存。远端连接弹窗（30）的默认 API 地址使用新产品端口，弹窗背后的端列表取自新账号；通知历史（31）显示这次真实交付产生的事件数。已修复的交互差异包括任务详情的侧栏选中态，以及从通知进入已缓存任务时的评论焦点。图像与业务写入可分别核对。[40 组图](comparison.html) · [原生交互记录](native/results.json)

## 重放

在研究仓的 `products/dsh-team-workbench` 目录执行。自动回放每次新建合成账号、项目与团队，随机口令保存在受限的本机目录。依赖为冻结源码和离线依赖、pnpm、Python 3.11+ 与 Playwright、Pillow、Google Chrome、macOS 辅助功能权限及本机编译工具。重新打包用于复演构建过程。只检查已交付包时可直接从 Finder 回放开始。[完整依赖及资料布局](../desktop-runtime.md)

```sh
pnpm build
pnpm check:types
pnpm test
scripts/build-desktop
```

**Finder 和双客户端原生。** 先从产品 A/B 菜单正常退出，结束占用本产品验收端口的开发服务。Finder 测试会读取原生辅助功能树中的登录字段，并核查实际服务进程。双客户端脚本随后打开带检查端口的 A/B，保留窗口给项目与工作台回放。40 幅对照由两组原生画面共同生成。

```sh
scripts/local stop
python3 tests/native/finder.py --output .local/replay-macos
scripts/local stop
python3 tests/migration/replay.py --keep-windows --output .local/replay-native
python3 tests/review/run.py --ports 19883 19884 --output .local/replay-project-workbench
python3 tests/migration/compare.py .local/replay-native .local/replay-project-workbench --output .local/replay-compare.html
```

**规划与浏览器。** 待原生取证完成后运行。规划脚本验证 Chrome 所载的五份 DSH 客户端文件与包内字节对应。浏览器整套回归会重启本产品 A 的 Host、短暂停 API 并恢复，适合独占测试服务时运行。

```sh
python3 tests/review/planning.py --output .local/replay-planning
WORKBENCH_JOURNEY_RESULTS="$PWD/.local/replay-browser-journeys" \
WORKBENCH_REVIEW_RESULTS="$PWD/.local/replay-browser-project-workbench" \
WORKBENCH_ASSEMBLY_RESULTS="$PWD/.local/replay-browser-assembly" pnpm test:browser
```

**原型撤销对照。** 保持产品测试 API 和资料 A 的 Host 运行。在另一个终端从产品目录启动冻结前端，仅连接本次合成测试 API。端口 14683 供该对照独占。

```sh
cd ../../.local/demo-v2/src/mobile-work-client/apps/app
VITE_TEAM_API_URL=http://127.0.0.1:19015 ./node_modules/.bin/vite --config vite.team.config.ts --host 127.0.0.1 --port 14683 --strictPort
```

回到产品目录执行以下命令。结束后在原版前端终端按 Ctrl+C。

```sh
python3 tests/review/undo_reference.py --output .local/replay-undo
```

**原生补充项。** 执行端和原生菜单使用独立资料、独立端口及合成凭据。全部完成后退出本轮测试窗口，执行端和两套本机资料的清理命令见[本机运行说明](../desktop-runtime.md)。

```sh
python3 tests/native/runtime.py --output .local/replay-macos
python3 tests/native/shell.py --output .local/replay-macos
python3 tests/native/agents.py --output .local/replay-macos
python3 tests/native/remote.py --output .local/replay-macos
```
