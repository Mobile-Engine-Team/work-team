# 冻结桌面渲染器的迁移与重建

产品通过 DSH 装配五个浏览器模块。工作区壳注册根页面，挂载本人会话、React Query、HashRouter 和工作台。项目和蓝图使用同一工作区作用域。任务、收件箱、小队、成员与智能体分别通过 `workbench.page` 槽注册。侧栏与深链均根据本次 DSH 装配定位页面。构建后的 .app 从自身资源加载这些模块。

| 层 | 实现与复核入口 |
|---|---|
| 壳及页面装配 | [壳入口](../packages/ui-workspace-shell/client.jsx)、[作用域](../packages/ui-workspace-shell/views/pages.tsx)、[任务](../packages/ui-tasks/client.jsx)、[收件箱](../packages/ui-inbox/view.tsx)、[小队](../packages/ui-squads/client.jsx)、[成员与智能体](../packages/ui-members/client.jsx) |
| 冻结页面与控件 | 工作区、任务、成员、项目、结论及蓝图组件在[团队域](../packages/ui-workspace-shell/views/team)。界面正文、附件、语义控件和中文输入行为随相应组件保留。工作台的回答、依据、A2UI 和隔离的旧布局 worker 在[工作台域](../packages/ui-workspace-shell/views/workbench)。逐控件条件见[行映射](migration-evidence/controls.md)。 |
| 登录与跨页同步 | [密码登录](../packages/ui-workspace-shell/views/team/password-auth.ts)通过 Host 写入会话。浏览器在 sessionStorage 存当前登录标记，Multica JWT 由 Host 保管。工作台草稿的本地键包含账号、工作区、对话；[工作区上下文](../packages/ui-workspace-shell/views/team/client.tsx)订阅 Host 转发的事件，按变更失效相应查询。 |
| 上传、下载及异步回答 | [传输适配](../packages/ui-workspace-shell/views/team/request-transport.ts)与 [Host 路由](../packages/multica-host/transport.js)转发请求、字段、状态码及响应类型。文件上传复用 SDK 的 multipart 结构，下载读取后端文件字节。回答进度按 [SSE](../packages/ui-workspace-shell/views/workbench/api.ts) 消费。 |
| 本机及远端 | [执行端适配](../packages/ui-workspace-shell/views/team/desktop.ts)通过 Host 提交操作；当前用户、执行端凭据和系统对话框由执行桥处理。SSH 表单预填当前 Multica 地址。真实付费生成与外部 SSH 按 D-08 暂缓。 |

## 重建

在产品目录运行 `pnpm install --frozen-lockfile`、`pnpm build`、`pnpm check:types`。编译使用用户冻结的 MobileWork 客户端及其离线依赖，默认位于研究仓 `.local/demo-v2/src/mobile-work-client`。工作副本在其他位置时，将 `WORKBENCH_V2_SRC` 指向含 `apps/app/node_modules` 及 `packages/multica-core` 的冻结 checkout。

[构建脚本](../scripts/build.mjs)检查 Git HEAD `dbf36f4d2a9b69779c18cb5fec22ce3ee6302a69` 及共享源码，再解析同一依赖树内的 Vite、Tailwind、基础组件、中文词条、Multica TypeScript SDK、A2UI 和 QuickJS。React 使用 DSH 提供的实例。页面插件共享根模块导出的查询、路由及工作区上下文；模型目录与其他 API 查询共用已绑定的 Multica 实例。3 条 hash 路由取自冻结的 `team-pilot.tsx`。macOS 的 32 px 标题区、14 px 滚动轨和团队样式级联按冻结桌面还原。

每个 UI 包输出独立的 `dist/client.js` 和 `dist/THIRD-PARTY-NOTICES.txt`，打包脚本收集全部 `dist` 文件。后者包含[上游客户端许可](../packages/ui-workspace-shell/assets/LICENSE.upstream)、[Multica 许可](../packages/ui-workspace-shell/assets/LICENSE.multica)、[Multica NOTICE](../packages/ui-workspace-shell/assets/NOTICE.multica)及解析到的第三方包声明。编译期将冻结 SDK 上传方法接入产品 Host。冻结 checkout 和已安装依赖仅用于重建。桌面产品运行依赖详见[本机运行说明](desktop-runtime.md)。

[类型检查](../scripts/check-renderer-types.mjs)按五个 DSH 客户端入口遍历实际引用的 TS/TSX，使用冻结依赖的包导出和类型声明，以 strict、noEmit 检查。原生、业务结果和角色权限的运行证据见验收总表。
