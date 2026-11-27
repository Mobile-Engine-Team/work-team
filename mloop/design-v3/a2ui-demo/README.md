# A2UI 1.0 Studio

输入自然语言 → OpenAI 兼容模型生成 A2UI 1.0 JSON → 官方 Schema 校验 → 前端组件渲染。支持连续修改、表单数据绑定、动态列表、按钮事件回传模型，以及协议 JSON / 当前数据 / 事件查看和 JSON 导出。

## 启动

```sh
cd a2ui-demo
npm install
npm start
```

打开 http://127.0.0.1:3210 。需要 Node.js 22+。默认调用 `http://127.0.0.1:8766/v1/chat/completions`，模型 `auto`。模型请求从 Node 服务代理，浏览器无需配置跨域。

可通过启动环境变量覆盖：

```sh
OPENAI_BASE_URL=http://127.0.0.1:8766/v1 OPENAI_MODEL=auto PORT=3210 npm start
```

需要认证时设置 `OPENAI_API_KEY`；密钥只在服务端使用。服务仅监听 127.0.0.1。没有数据库，刷新会清空当前会话；可先导出 JSON 保存页面与当前数据。

## 协议范围

以 [A2UI 1.0 官方规范](https://a2ui.org/specification/v1.0-a2ui/) 为准，使用 `version: "1.0"`、`createSurface`、`updateComponents`、`updateDataModel`、`deleteSurface`、`@path` 和 `action.event`。创建支持内联 components / dataModel，更新保留已有控件和用户数据；按钮将 1.0 `action` 以及 transport metadata 中的 `a2uiRendererDataModel` 发送回模型。

这是自行实现的 **A2UI 1.0 子集渲染器**，不是官方 SDK，也不是全协议实现。自定义 catalog `urn:a2ui-demo:catalog:1.0` 基于官方 Basic Catalog 子集，明确只包含已实现组件：Text、Image、Icon、Row、Column、List、Card、Tabs、Divider、Button、TextField、CheckBox、ChoicePicker、Slider、DateTimeInput。支持 required / email / length / numeric / and / or / not 检查。未注册 RPC、其他 catalog、媒体、Modal 或通用表达式。

界面样式由前端控制，不执行模型生成的 HTML / JS。Schema 校验和组件树完整性检查失败会自动请求模型修正一次；失败后保留上一页并显示错误。API 目前是请求响应模式，模型完整生成并校验后提交这一批消息，不是 token 流式展示。页面数据为模型生成的示例，提交/订单等事件仅由模型更新演示界面，不连接真实业务。

## 文件

- `server.mjs`：静态文件服务、模型代理、提示词、修正重试。
- `protocol.mjs`：Ajv 2020-12 校验器、JSON / JSONL 解析。
- `schemas/agent_to_renderer.json`、`schemas/common_types.json`：从 a2ui.org 获取的官方 1.0 Schema。
- `schemas/catalog.json`：基于官方 Basic Catalog 的已实现子集。
- `public/state.js`：独立状态机、JSON Pointer、相对模板绑定、校验函数。
- `public/app.js`：受控 DOM 渲染器、输入绑定、对话与事件处理。
- `public/style.css`：原生界面样式与响应式布局。

运行 `npm test` 验证 Schema、增量更新、表单数据保留、模板绑定、循环引用和危险数据路径。
