# Demo V2 首批 DSH 迁移详设

2026-11-25。本文是实施起点。验收时逐项补充实际采用的传输、装配和界面证据。产品运行在一台 Mac 上，允许两位用户用各自的浏览器上下文和本机 Host 资料模拟协作。

## 产品边界

成员用账号密码注册或登录，进入个人工作区，从顶栏「＋」创建团队空间，邀请同事。成员在团队空间创建任务、分派、讨论。收到通知的同事从收件箱进入同一任务的指定评论。团队可以配置 Agent、组建小队，并查看实际登记的执行端。切回个人工作区时，每一页都随当前空间更新。以这一条路径验证多人和跨插件协作，以独立插件的启停验证 DSH 选型。

首批交付工作区壳和四个业务页面。个人与团队共用这些页面。已讨论的后续范围有独立项目管理页、工作台对话、A2UI、Pin、个人文档流转和企业登录。任务表单已有的项目查询保留。按设计图启用本机执行端插件，覆盖登记、启停、状态与 Agent 绑定。远程机器安装和跨机部署另议。开发时执行端和 API 都指向本机隔离环境。

## 基线与阅读入口

从研究仓根目录可以找到以下路径。启动时校验版本，以实际 HTTP 和页面行为决定字段和细节。

|对象|固定版本与位置|优先阅读|
|---|---|---|
|V2 Client|dbf36f4d2a9b69779c18cb5fec22ce3ee6302a69，.local/demo-v2/src/mobile-work-client|apps/app/src/react-app/domains/team 下的 team-page.tsx、tasks.tsx、squads.tsx、team-settings.tsx、client.tsx、password-auth.ts、desktop.ts；domains/workbench/workbench.tsx；packages/multica-core/api|
|Multica|a7859a4715fd589d9460512ad805588210a5f0c5，.local/demo-v2/src/multica|server/internal/handler/workspace.go、workbench_workspace.go，server/internal/middleware/workspace.go；server 路由和 CLI_AND_DAEMON.md|
|DSH|本机 CLI 0.2.1-rc.3，源码 ../deepseek-harness 的 ca33fd6843b205e279c7ccb6cb73a472c78f5760|docs/subsystems/slots.zh.md、docs/user/develop/basic/publish.zh.md、docs/api-gateway.zh.md|
|本地装配样例|work/IDEA-001/dsh-application-architecture-2026-11-20/examples/product-bundle|start.sh 和三个包；样例已验证 profile 装入树外插件与受保护的 Host 路由。正式实现要验证真实业务、最终壳和安装后的包。|
|界面与本地环境|同目录 dsh-migration-design.html；work/IDEA-001/demo-versions/v2-20261117/RESTORE.md|HTML 的八个节点、已有数据库与端口用途。保留演示环境。|

## 插件分工

|包|拥有的交互、状态|依赖及可单独验证的结果|
|---|---|---|
|product-bundle|产品包依赖、cordis.patch.yml、默认插件组合|profile 依次组合 DSH base、web-app、产品 bundle。检查最终合成配置、实际激活和浏览器贡献三者。|
|ui-workspace-shell|注册登录、退出、V2 顶栏、创建／切换空间、侧栏、当前路由|壳向功能页提供工作区快照、导航及页面 Slots。壳负责失效路由回退，侧栏按已注册贡献生成。移除一个业务插件后，其他页面仍可用。|
|ui-tasks|任务列表、V2 可见的筛选、新建、详情、状态／负责人等现有操作、评论、目标评论定位|依赖壳的插槽、工作区和任务能力。任务数据由 Multica 持有，筛选与编辑草稿留在页面内。|
|ui-inbox|当前用户在当前空间的通知、已读／未读、归档／恢复、打开来源|消费通知服务与壳的导航。把事件自身对应的 issueId、commentId 交给导航，保留 V2 同一事项多条通知的定位语义。|
|ui-squads|小队列表、创建、编辑、详情、小队负责人、成员及角色|消费小队、Agent 和成员查询；选择项随工作区更新。小队对象持久化到 Multica。|
|ui-members|人和 Agent 名单、邀请／状态、Agent 创建与编辑、选择执行端，展示本机管理控件|消费成员、邀请、Agent、runtime 的业务操作。本机进程控制由可选 bridge 提供；该插件关闭时，仍可使用已登记 runtime 和其余团队管理能力。|
|multica-host|账号会话、按人按空间访问 Multica、统一错误与凭据处理|同一包内按会话、工作区、任务、通知、小队、成员／Agent 分模块。业务状态、授权、派工和运行回执以 Multica 为准。|
|execution-bridge|启动及停止本应用管理的本机 daemon、查询状态、登记、报告故障|复用 V2 的进程和身份管理行为，隔离 HOME、profile、工作目录及登记身份；进程重启后绑定可恢复。模型和 CLI 的发现按冻版入口盘点，只呈现有实际实现的控件。|

## 三个跨包契约

1. **当前身份与空间。** 壳给页面当前用户、workspaceId、类型和可用动作。Client 遇到换用户或换空间时取消旧请求或丢弃过期响应。列表、计数、缓存按用户与空间区分。新账号的个人空间来自服务端，创建团队空间成功后使用服务端返回的 ID。账号未加入或被撤权时由服务端拒绝访问。
2. **功能页与导航。** 业务包向壳声明入口和页面。收件箱打开任务的最小目标是 workspaceId、issueId 和可选 commentId。壳切到目标空间和任务页，任务包自行获取详情、滚动定位。目标不存在时显示可理解的错误，并保留回到收件箱的路径。共享类型和路由目标从公开入口导出。每个包自行维护页面组件与私有状态。
3. **Client 调 Host。** 优先验证独立包可交付的 DSH 官方 Remote 路径；如固定版本的生成步骤依赖上游构建，可采用教学样例已验证的 DSH connection 受保护路由，在产品仓内统一调用方式，登记取舍。首批能力按业务操作开放，如「列出我的通知」「修改指定任务负责人」。Host 自己确定上游地址及会话，按 Multica 的实际约定传空间。浏览器中的 DSH 本地连接身份、Multica 用户令牌、daemon 登记凭据分别处理。本机两账号隔离通过独立 profile/Host 或经验证的逐会话存储实现。禁止全局 token 导致两个客户端串号。

## 页面和运行行为

- V2 壳保留顶栏工作区选择器、「＋」、退出和四项侧栏入口。DSH 壳接管 root 时按固定版 Slots 声明并注册子槽，保留渲染器需要的服务。最终打开即到工作台。上游示例的底部调试组件只用于验证装载。
- 数据写入由 Host 调用冻版接口。创建按钮在提交中有明确反馈并阻止重复点击；超时后先查结果再决定是否重试。评论、邀请或其他写入失败时保留输入。未授权、网络故障、空列表呈现各自状态。
- 执行链由 Multica 登记 runtime、派工，daemon 领取并上报。Host 可管理已授权的本机实例，只停止本产品启动且已核对身份的进程。验收记录区分登记在线、任务领取与产出回执、真实模型完成三层。
- 依赖方向为功能 UI → 壳公开契约和业务客户端 → Host → Multica。业务 UI 之间通过公开导航协作；禁止跨插件深层导入与整仓链接回原 MobileWork。原页面可复用经拆分的展示和 API 实现，保留复用源码出处及必要许可。DSH 核心的改动需求作为选型发现单列。

## 装配与本机数据

使用一个 pnpm workspace，提交共享 lockfile。产品 bundle 的 dependencies 使插件可解析，DSH patch 逐项插入或覆盖插件；必需服务由插件声明 inject，页面由 Client 入口注册。独立产品 profile 持久保存于受限的本地运行目录，区分开发、测试与两账号。验证默认组合、禁用执行端管理和临时移除收件箱三种组合。

开发使用新数据库或隔离实例、新上传目录、新端口、新账号和独立 daemon 资料。复用本地冻版二进制或源码构建。启动前查端口所有者，脚本记录自己创建的资源，支持重复启动和定向停止。开发机已保存的账号、数据库、演示进程及恢复归档保持可继续演示。日志和测试报告只保留脱敏结果。最终交付包含一条从新 checkout 启动产品的可复现路径。
