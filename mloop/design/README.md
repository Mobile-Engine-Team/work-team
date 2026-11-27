# MobileWork 多页静态设计稿

直接打开 [index.html](index.html) 进入首页，或打开 [overview.html](overview.html) 浏览全部 22 个页面。整个 design 目录可整体复制，运行时不需要 work 目录、网络、登录、服务器或安装依赖。

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

需要修改并重新构建时，在当前机器运行 `node design/build.mjs`；构建使用现有 work 仓库的 Vite 和依赖，不会写入 work。浏览已生成 HTML 不需要这些依赖。

## 验证范围

逐页检查脚本错误、图片加载与整页横向溢出，并检查首页、技能、自动化及设置的截图与关键交互。任务页和共用侧栏已与用户提供的实机截图做同窗口尺寸视觉对照；其余页面依据源码核对，尚未逐页进行实机截图比对。滚动条长度因静态对话总长度不同而有差别。
