# 守护进程与运行时

本次新增设置菜单「守护进程」「运行时」，入口：

- `settings-daemon.html`
- `settings-runtimes.html`

守护进程页已移除重复标题栏，仅保留偏好设置卡片与诊断信息，并缩紧窗口宽度和顶部留白。

默认置于 Work 设置窗口中，沿用 Work 菜单、字体和主题颜色。两个入口也收录于 `overview.html`。

## 可操作流程

守护进程：自动启动、自动停止开关；CLI 状态和八项诊断信息。配置自动保存。

运行时：全部/在线/离线筛选；机器、Harness、智能体数、负载、状态分组列表；机器详情、重命名和清空名称；本机守护进程启动、停止、重启和日志；运行时详情、可见性、成员授权、并发上限；创建/编辑/删除自定义运行时；用量视图和空数据展示。其他成员机器显示只读配置。

添加机器：macOS/Linux、Windows 命令切换、复制、Token 登录说明、检查连接、成功状态和新机器详情。

Qoder：服务区域、PAT 校验状态、环境选择、GitHub 仓库授权、并发和超时校验；连接、编辑、暂停/恢复、移除仓库和断开连接确认。

## 静态数据边界

全部业务操作使用本地示例，不请求真实服务，不启动或停止操作系统进程。远程接入在展开的帮助中点击「检查连接」后展示示例机器。Qoder 令牌以 `pt-` 加至少六位字母、数字或连字符演示校验；本地成功状态不代表真实凭证有效。令牌和仓库访问凭证不写入 localStorage；其余演示配置保存在 `work-v2-runtime-settings-v1`。

## 参考

- 用户提供的两张截图为页面视觉依据。
- Multica 本机源码：`apps/desktop/src/renderer/src/components/daemon-settings-tab.tsx` 与 `packages/views/runtimes/components/`。
- 已在 Multica 网页核对运行时列表、新增菜单与 Qoder 弹窗；在线服务缺少 `MULTICA_VCS_SECRET_KEY`，完整连接表单依据源码复现。
- 提供商图标与命令解析直接复用 Multica 源码；原许可证见 `assets/multica/LICENSE`。

## 构建与检查

运行 `node design-v2/build.mjs` 更新共享构建产物。浏览器验证记录在 `runtime-settings-verification.json`，最终截图在 `previews/settings-daemon.png`、`previews/settings-runtimes.png`。本次实现范围为上述两个模块；共享设置导航和 HTML 构建版本号随构建更新。
