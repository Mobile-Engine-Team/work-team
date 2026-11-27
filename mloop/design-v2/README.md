# MobileWork 多页静态设计稿

## 2026-11-10：团队协助改为双模式任务创建

普通 Work 对话只保留右上角「团队协助」一个入口。移除回答下方入口、会话卡片、跨团队关联查询和自定义 assistance 字段；历史演示数据不删除。

右侧抽屉从顶部覆盖展开，使用简洁的标题、灰底模式切换和任务属性行。手动创建提供标题、描述、智能体 / 小队执行方搜索；智能体创建提供创建者、需求输入。两种模式分别保留编辑草稿，共用团队、项目和优先级。

「引用当前对话」只在用户点击后将文字填入描述，可自行编辑；没有来源链接、双向关系或消息同步。两种模式最终只保存普通任务字段到所选团队看板。智能体模式以需求首行作为演示标题，不调用智能体、不模拟真实生成和执行，不接入 Multica 后端。真实产品应使用 Multica 既有的手动 / 智能体创建 API。

已验证单入口、刷新后无卡片、两种模式草稿、手动 / 智能体任务保存、所选团队隔离、取消后原草稿保留、必填校验与小窗口无横向溢出。构建与 `git diff --check` 通过。预览：[手动创建](previews/team-assistance-manual.png)、[智能体创建](previews/team-assistance-agent.png)。

## 2026-11-10：创建团队与工作区管理

在紧凑团队切换菜单底部增加「创建团队工作区」和「工作区设置」，保持左侧导航高度不变。创建只填写头像、名称与描述；成功后可进入空工作区，或继续邀请成员。新团队不复制示例任务、智能体、小队和群聊，原有 Work 普通会话始终保留。

设置使用独立弹窗，分为基础信息与成员管理。基础信息可修改头像、名称、描述、智能体上下文；标识只读，关闭未保存修改时有确认。成员页提供搜索、角色调整、移出确认，分成员 / 待接受邀请 / 邀请链接三个标签。支持批量邮箱校验与去重、创建与撤销邀请、创建 / 复制 / 停用 / 删除邀请链接。普通成员只读，所有者与管理员可管理，当前成员和所有者不提供移出按钮。

团队目录、配置与邀请本地保存，现有团队沿用原存储键。成员更新与已有团队数据同步。邀请仅为静态交互，不发送邮件，不实现真实加入或服务端鉴权。

浏览器已验证创建与空数据、原有会话和草稿保留、改名与上下文刷新后恢复、成员角色调整、搜索、邀请校验 / 重复邮箱 / 撤销、链接启停 / 删除、未保存关闭确认、嵌套 Escape、只读角色与窄窗口布局。构建及 `git diff --check` 通过。详情见 [验证记录](team-management-verification.json)。预览：[创建](previews/team-create.png)、[基础信息](previews/team-settings-general.png)、[成员管理](previews/team-settings-members.png)。

## 2026-11-10：补齐通过智能体创建任务

看板所有新建入口、子任务入口、智能体 / 小队的“分配工作”共用任务创建弹窗，底部可在“手动创建”和“通过智能体创建”之间切换，并记住上次使用的方式。编辑已有任务仍使用手动表单。

- 智能体模式选择当前工作区的智能体或小队，使用富文本描述需求，无需填写任务标题；支持项目、优先级、截止日期、父任务、附件信息与继续创建。
- 切换模式保留标题、描述、项目、优先级、日期和父任务；智能体 / 小队选择与手动负责人联动。附件保留在智能体草稿中。
- 提交将请求写入当前团队的共享工作区 `issueCreationRequests`，展示保存结果；继续创建清空需求与附件并保留公共属性。静态原型不调用模型、不生成虚假的执行结果，附件仅保存名称、大小和类型。

源码：`_src/multica-ui/board-task-form.tsx`、`_src/task-create.css`、`_src/multica-ui/store.ts`。验证记录：[创建流程](task-create-verification.json)；预览：[通过智能体创建](previews/task-create-agent.png)。

## 2026-11-10：团队工作区切换

团队切换并入左上角品牌栏，采用单行团队名称与下拉箭头；移除新增的常驻卡片和二级标签，不占用额外导航高度。点击展开团队搜索、当前团队与角色，菜单覆盖展示。保留 Work 品牌蓝、原有导航和会话行的样式。

- 提供「产品研发团队」与「品牌运营团队」两个静态示例。团队看板、收件箱、智能体、小队、自动化、私聊和小队群聊随团队切换；原有 Work 普通对话、任务、本地文件空间与个人配置保留。
- 在普通 Work 任务内切换，当前任务与输入草稿保持；在团队对象详情内切换，进入新团队对应模块列表，清除旧对象参数。链接携带团队标识，当前窗口记住选择。
- 默认团队沿用既有存储键，新增团队独立保存；不迁移或清空以前的原型数据。仅为静态演示，不连接团队与权限服务。

已浏览器验证：普通会话与草稿保留、团队详情参数清理、刷新后团队恢复、智能体与自动化数据切换、小队群聊与私聊示例、菜单搜索 / Escape 关闭、菜单展开时侧栏无横向偏移。构建与 `git diff --check` 通过。预览：[页面](previews/team-switcher.png)、[切换菜单](previews/team-switcher-menu.png)。

## 2026-11-09：私聊精简与小队群聊

智能体私聊继续使用 `agents.html?id=…&chat=1&session=…`，替换旧的聊天页面，沿用群聊的宽布局、气泡、输入框和 Work 配色。

- 私聊顶部只保留搜索和设置；移除右侧会话列表、切换 / 新建图标、会话数量入口及侧栏“对话”旁的小加号。设置只展示名称、简介、状态、所有者、运行时、模型、Harness 与技能。
- 用户和智能体示例消息交替展示。已有仅含用户消息的旧原型会话补充标明为示例的回复，保留原消息；新建空会话不会在刷新时凭空增加回复。
- 同一个智能体仍可有多个独立会话：从智能体详情点击“对话”直接创建新会话，第一条消息生成主题标题，历史入口统一保留在左侧“任务 → 对话”。消息、附件和草稿本地保存，聊天记录可搜索、分类和定位。
- “任务 → 对话”同时保留智能体私聊、两条已有看板任务和原有普通会话。任务带“任务”标记，点击 `work.html?issue=…` 打开统一任务详情；普通会话继续打开 `task.html?task=…`，恢复原来的 9 条记录，默认展示 5 条并支持查看更多与搜索。
- 小队详情新增“对话”按钮，进入 `group-chat.html?squad=…`。群名、简介、成员、队长、职责、指引、可见范围和智能体配置直接读取该小队；在小队详情统一管理，群内不另建配置。发起后加入左侧群聊列表，重复进入复用同一群聊。小队消息保存在当前浏览器，示例对话不连接真实智能体服务。

验证记录：[私聊与小队群聊](private-squad-chat-verification.json)。预览：[私聊](previews/agent-chat.png)、[基础信息](previews/agent-chat-info.png)、[小队群聊](previews/squad-chat.png)、[小队群配置](previews/squad-chat-info.png)。

## 2026-11-09：嵌套页面、属性栏与弹窗逐项回归

本轮继续对照 Multica 实际智能体 / 小队 / 对话页面和源码，调整对象页工具栏、成员行、属性栏及多层弹窗，并实际点击验证。覆盖记录见 [interaction-audit.json](interaction-audit.json)，不将本地原型等同于真实服务功能。

- 智能体设置改为通用、访问权限、环境变量、自定义参数、Skills、MCP 六个分区。名称 / 并发校验、自动保存、成员权限、环境变量解锁与校验、技能选择 / 暂停、参数预览和未保存更改确认均可操作。
- MCP 二级窗口支持 stdio / HTTP、参数、环境变量、请求头及表单 / JSON 切换；编辑保留额外 JSON 字段。名称、URL 和 JSON 输入有校验；Escape 只关闭当前窗口。
- 智能体 / 小队支持名称和描述快速编辑、头像、更多操作、复制链接 / ID、属性栏开关、全部工作搜索、角色编辑和队长交接。复制智能体进入配置流程并保留高级配置；归档 / 恢复更新任务分配选项。
- “分配工作”复用完整看板表单，支持项目、优先级、状态、标签和日期。从工作记录进入统一看板详情；改名保留关联，删除任务后不会被智能体页重新生成。小队出现在看板的负责人选项、筛选和分组中。
- 私信入口与界面已由上方“私聊精简与小队群聊”替换；示例回复仅用于静态展示，不调用模型。
- 修复定时任务复制窗口被详情弹层遮挡的问题，以及复制后修改时间表 / Webhook 筛选没有写回的问题。验证 Prompt 保存、启停、运行记录、关联任务和删除确认。

新增源码：`_src/agent-settings.js`、`_src/agent-mcp.js`、`_src/agent-chat.tsx`、`_src/interaction-polish.css`。预览：[设置](previews/agent-settings-general.png)、[MCP 二级编辑](previews/agent-settings-mcp.png)、[智能体详情](previews/agent-detail-new.png)、[小队详情](previews/squad-detail-new.png)、[对话](previews/agent-chat.png)。


## 2026-11-09：详情与创建流程精修

本轮按实际 Multica 页面、用户截图与源码核对流程，统一使用 Work 的品牌蓝、灰阶、字体、表面、输入框和按钮。验证记录见 [detail-flow-verification.json](detail-flow-verification.json)。

## 定时任务：统一配置与详情

`automation.html` 卡片已缩小；统一使用右上角“新建”，移除重复的“添加定时任务”按钮。空状态模板和 `automation-create.html` 复用同一配置表单，包含名称、富文本 Prompt、执行方、输出模式、项目、订阅者、时间表 / Webhook、事件筛选、时区与 Cron 预览。

点击卡片在原列表上打开详情弹窗（例如 `automation.html?job=job-0`），关闭后回到原列表。详情包含 Prompt、触发器、运行历史及属性侧栏，可编辑属性和 Prompt、新增 / 编辑 / 暂停 / 删除触发器、启停、删除及手动运行。嵌套编辑弹窗的 Escape 只关闭最上层。

配置和记录保存到 `mw-scheduled-tasks-v2`。手动运行的“创建任务”模式会写入共享看板，并可从运行记录打开任务；“仅运行”模式只生成本地请求记录。没有后台定时执行、真实模型运行或 Webhook 接收服务。

源码：`_src/scheduled-tasks.tsx`、`_src/scheduled-tasks.css`，从 `_src/main.tsx` 挂载，统一编入 `assets/build/design.js` 与 `style.css`。在仓库根目录执行 `node design-v2/build.mjs`。HTML 不再重复加载旧的 scheduled 分包。

预览：[列表](previews/scheduled-list.png)、[弹窗详情](previews/scheduled-detail.png)、[新建配置](previews/scheduled-create.png)。

## 专家工作区：智能体与小队

入口为 `agents.html` 和 `squads.html`。卡片已缩小，沿用专家工作区页签、Work 外壳和品牌配色。

- 创建智能体采用“选择运行时 → 配置 → 完成”三步流程，配置页支持头像颜色、名称、描述、开场建议、指令、Skills、模型、速度和访问成员；返回上一步保留输入。运行时连接为本地演示配置。
- 智能体详情包含当前 / 最近工作、指令、Skills、小队和属性侧栏，支持配置编辑、复制、归档 / 恢复及分配工作。
- 创建小队包含头像颜色、名称、描述、队长、可搜索的智能体 / 人类成员与访问权限。详情支持成员角色、移除成员、交接队长、指引和工作记录。队长自动加入，不能直接移除。
- 配置保存在 `mw-expert-agents-v1`；智能体、小队和分配任务同步到共享的 `mw-multica-workspace-v4`，可供看板和定时任务选择。看板任务状态变化会反映到智能体 / 小队详情，编辑配置不覆盖任务状态。刷新保留。

功能参考：`/Users/xymtop/Desktop/multica/packages/views/agents/`、`packages/views/squads/`，以及已打开的 Multica 实际页面。官方运行时标识来源与许可见 `assets/runtime-providers/NOTICE.txt`。

实现文件：`_src/agent-workspace.js`、`_src/agent-workspace.css`、`_src/workspace-tabs.tsx`，同样由完整构建统一打包。无需执行旧的分发包注入脚本。

预览：[智能体列表](previews/agents-new.png)、[创建智能体](previews/agent-create-new.png)、[智能体详情](previews/agent-detail-new.png)、[小队列表](previews/squads-new.png)、[创建小队](previews/squad-create-new.png)、[小队详情](previews/squad-detail-new.png)。

看板详情本轮补充属性动态、带时间的评论与回复、订阅者、唤醒配置、关联链接和本地执行请求；父任务选择排除后代，避免循环。预览见 [任务详情](previews/work-board-detail.png)。执行用量与费用没有真实数据时显示空值，不模拟成功执行。

## 群聊静态设计

新增 [测试群聊](group-chat.html)，入口位于共用侧栏的会话列表中，带「群聊」徽章。沿用 Work 的窗口、侧栏、字体、浅蓝底色、品牌蓝、按钮和输入框样式。主区域为聊天，顶部仅保留搜索、添加成员和设置三个图标；成员管理收在群聊信息内。右侧抽屉从会话顶边覆盖展开，盖住顶部工具栏，聊天区域不随抽屉开合改变宽度。默认收起，支持点外部或 Escape 关闭。文本、图标、气泡、表单和头像使用 Work 的原有品牌蓝、灰阶与表面样式，助手使用原有机器人头像。

聊天区与输入框已改为随窗口宽度展开，取消 820px 居中窄列限制，桌面两侧留白为 28–56px。正文 16px，头像 40px，图片预览 420px，文件卡片 360px；消息气泡保留阅读宽度限制。大屏预览见 [1920px 宽版聊天页](previews/group-chat-wide.png)。

可演示群名称、简介和公告编辑，成员搜索、分类、添加、移出与管理员设置；文本、表情、@成员、文件和图片发送，引用回复、表情回应和图片放大；历史记录关键词搜索、高亮、消息类型、成员和日期筛选及定位原消息。群名称变更同步到当前侧栏和窗口标题。所有变更仅在当前页面内展示，刷新恢复示例，不连接消息或成员服务；示例文件展示详情，本地上传文件不会上传到服务器。

页面可直接离线打开。源码为 `_src/group-chat.tsx`、`_src/group-chat.css`，示例图片为 `assets/group-chat-preview.svg`。预览见 [聊天页](previews/group-chat.png)、[群信息抽屉](previews/group-info.png)、[成员管理](previews/group-members.png)、[记录搜索](previews/group-history.png)。构建和交互验证记录见 [group-chat-verification.json](group-chat-verification.json)。

## 看板本轮调整

“工作”已改名为“看板”。使用 Work 的外壳、字体、蓝色强调色、按钮和弹窗；移除重复页头，将新建任务和栏目折叠入口收进单行工具栏，适度增大导航、卡片、文字和操作区域。

按实际 Multica 显示菜单恢复看板、列表、表格、泳道四种视图，入口位于显示弹层内。四种视图共用任务与筛选条件，显示设置按视图本地保存；列表按状态分组，表格支持属性编辑、显示列、分组与 CSV 导出，泳道支持按负责人、项目、父任务分组，拖动同步修改所在行与状态，新建任务带入所在位置的属性。

任务支持创建/编辑、负责人和日期选择、子任务、富文本评论与草稿保存；项目支持属性、描述和资源编辑，视图支持筛选后保存。数据存于当前浏览器，尚未连接真实智能体执行或 Multica 后端，不代表所有 Multica 功能和像素细节均已复刻。样式限定在 body[data-page="work"] 下。本轮验证记录见 [board-verification.json](board-verification.json)，预览见 [看板](previews/work-board.png)、[显示菜单](previews/work-board-display.png)、[表格](previews/work-board-table.png)、[泳道](previews/work-board-swimlane.png)。

## v2 新增的 Multica 页面

在原 Work 侧栏的“定时任务”下面，依次新增 **收件箱、自动化、团队、看板**。四个入口的内容区域依据用户提供的六张 Multica 实机截图和 `/Users/xymtop/Desktop/multica/` 源码还原，外层继续使用 Work 的窗口和菜单。

| 页面 | 文件 |
| --- | --- |
| 收件箱、任务详情与动态 | [inbox.html](inbox.html) |
| 自动化任务列表 | [multica-automation.html](multica-automation.html) |
| 自动化空状态与六个模板 | [multica-automation-empty.html](multica-automation-empty.html) |
| 每日新闻摘要创建弹窗 | [multica-automation-create.html](multica-automation-create.html) |
| 团队与智能体列表 | [team.html](team.html) |
| 看板、项目与属性 | [work.html](work.html) |
| 六张参考图的滑动对照 | [multica-comparison.html](multica-comparison.html) |

默认页面显示 Work 外壳。除看板外，新增页面的 URL 加上 `?frame=multica` 可查看用于同尺寸核对的 Multica 原窗口外框（1470 × 841），例如 `inbox.html?frame=multica`。对照页展示保存的浏览器实际截图，全部资源可离线打开。

自动化模板填入 Runbook，可切换输出模式、时间表/Webhook，创建、编辑、暂停、删除；配置只存入本地浏览器。空状态和创建弹窗页面始终从空示例开始，自动化主列表读取本地保存结果。收件箱支持回复、评论、添加子任务、完成状态与归档；工作页支持新增示例任务、编辑项目属性、展开/收起详情。团队包含搜索和详情。其余次级菜单为静态展示，不连接真实智能体或业务服务。

新增源码为 `_src/multica.tsx`、`_src/multica.css`。图标直接取自 Multica 的 `packages/ui/icons/`；字体使用同款 Inter Variable；自动化的六个英文 Runbook 来自 `packages/views/autopilots/components/autopilot-templates.ts`。素材及原许可证、NOTICE 放在 `assets/multica/`。Inter 使用 SIL Open Font License，见同目录 `INTER-LICENSE.txt`。

验证：构建通过；全部 28 个应用页在 1470 × 841 下加载成功，无应用脚本错误、破图和整页横向溢出。四个模块已验证直接使用 file:// 离线打开，以及 1280 × 800 桌面窗口显示；自动化、收件箱、团队和工作页的主要本地交互已通过浏览器检查，记录见 [multica-verification.json](multica-verification.json)，截图见 `previews/multica-*.png`。六张参考截图已进行视觉对照；部分图标形状及细微字距会受源码版本和浏览器字体渲染影响。


直接打开 [index.html](index.html) 进入首页，或打开 [overview.html](overview.html) 浏览全部 28 个应用页面。整个 design-v2 目录可整体复制，运行时不需要 work 目录、网络、登录、服务器或安装依赖。

本版以 `/Users/xymtop/Desktop/mc/work/` 当前实际代码为依据，没有参考原型目录。使用原应用的 CSS tokens、字体、品牌图、机器人插画、图标和多种原组件；业务数据为静态示例。页面适合桌面浏览器查看。

任务页与共用侧栏已根据用户提供的 macOS 实机截图重新校准，可打开 [comparison.html](comparison.html) 拖动对照原图与浏览器实际渲染。

## 页面

| 页面 | 文件 |
| --- | --- |
| [新建任务](index.html) | `index.html` |
| [工作任务](task.html) | `task.html` |
| [技能市场](skills.html) | `skills.html` |
| [已安装技能](skills-installed.html) | `skills-installed.html` |
| [技能详情](skill-detail.html) | `skill-detail.html` |
| [专家](experts.html) | `experts.html` |
| [我的专家](my-experts.html) | `my-experts.html` |
| [工具市场](tools.html) | `tools.html` |
| [我的工具](my-tools.html) | `my-tools.html` |
| [定时任务](automation.html) | `automation.html` |
| [定时任务空状态](automation-empty.html) | `automation-empty.html` |
| [运行记录](automation-runs.html) | `automation-runs.html` |
| [新建定时任务](automation-create.html) | `automation-create.html` |
| [我的文件](files.html) | `files.html` |
| [账户管理](settings-account.html) | `settings-account.html` |
| [系统设置](settings-system.html) | `settings-system.html` |
| [记忆](settings-memory.html) | `settings-memory.html` |
| [模型](settings-models.html) | `settings-models.html` |
| [个性化](settings-personalization.html) | `settings-personalization.html` |
| [软件配置](settings-software.html) | `settings-software.html` |
| [安全与审计](settings-security.html) | `settings-security.html` |
| [帮助与反馈](settings-help.html) | `settings-help.html` |

## 与源码的对应

源码相对路径均位于 `work/apps/app/src/`。

| 静态页面/区域 | 主要源码依据 |
| --- | --- |
| 全局配色、字体、间距与自适应卡片网格 | `app/index.css` |
| 侧栏 | `react-app/shell/module-nav.tsx`、`sidebar-brand-bar.tsx` |
| 新建任务、场景与提示词 | `react-app/domains/session/chat/new-task-draft.tsx`、`surface/welcome-hero.tsx`、`surface/welcome-presets.ts`、`surface/composer/composer.tsx` |
| 工作区页签、搜索、筛选、开关、头像 | 直接使用 `react-app/domains/experts/workspace-ui.tsx` |
| 技能、专家、工具卡片 | 直接使用 `react-app/domains/experts/market-asset-card.tsx`、`react-app/domains/shared/card-grid.tsx` |
| 自动化任务卡与模板 | 直接使用 `react-app/domains/automation/task-card.tsx`、`template-grid.tsx` |
| 自动化表单 | `react-app/domains/automation/create-automation-modal.tsx`，直接使用 `react-app/domains/shared/modal-shell.tsx` |
| 设置窗口及八个分区 | `react-app/domains/settings/mobilework/mw-settings-route.tsx`、`pages/*.tsx`，直接使用 `kit.tsx`、`sections.ts` |
| 我的文件 | `react-app/domains/files/files-page.tsx` |

## 可演示的交互

页面之间可跳转；场景切换和快捷任务填入、技能搜索/分类/详情/启停、专家与工具入口、自动化筛选/新增/编辑/暂停/删除、文件搜索、设置切换/深浅色主题/滑块等可以在浏览器内演示。提交与配置变更只影响当前静态页面，不调用后台服务，刷新会恢复初始示例。

任务对话、运行记录和文件成果是用于展示排版的静态内容；依赖账户、云端、系统目录或真实模型服务的功能使用本地展示反馈。知识模块在当前源码版本中隐藏，因此未另行制作知识页。

## 文件结构与构建

- `assets/build/`：可直接运行的已编译 JS/CSS，字体及大部分样式图内联。
- `assets/original/`、`expert-img/`、`expert-workspace-icons/` 等：原应用图片资源。
- `_src/main.tsx`、`_src/design.css`：页面源文件。
- `_src/chrome.tsx`、`_src/task.tsx`、`_src/calibration.css`：修正后的共用侧栏、输入框、任务页与截图校准样式。
- `_src/presets.json`：从原预置技能与专家信息中提取的展示数据。
- `previews/`：浏览器实际渲染截图。
- `verification.json`：逐页加载及关键交互检查记录。

需要修改并重新构建时，在当前机器运行 `node design-v2/build.mjs`；构建使用现有 work 仓库的 Vite 和依赖，不会写入 work。浏览已生成 HTML 不需要这些依赖。

## 验证范围

逐页检查脚本错误、图片加载与整页横向溢出，并检查首页、技能、自动化及设置的截图与关键交互。任务页和共用侧栏已与用户提供的实机截图做同窗口尺寸视觉对照；其余页面依据源码核对，尚未逐页进行实机截图比对。滚动条长度因静态对话总长度不同而有差别。
