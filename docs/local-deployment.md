# macOS 本机部署

从组织私有仓库克隆后，在仓库目录执行。需要 Git、Python 3.9+ 和 Homebrew。首次准备通过 GitHub、npm 和 Go 模块代理下载公开依赖。

```sh
brew install node@24 go postgresql@18 pgvector
./scripts/deploy setup
./scripts/deploy model
./scripts/deploy open
```

`setup` 校验 PostgreSQL 的 pgvector，安装锁定的 DSH 及工作台依赖，重建本产品使用的 Multica API、迁移工具和执行端。浏览器插件从仓库中的构建产物安装。详见 [部署依赖来源](../deploy/README.md)。

`model` 在终端隐式读取自己的 DeepSeek API Key，写入 `.local/standalone/model.private.json`。工作台问答、视图刷新和新启用的本机 Pi 执行端使用这份配置。真实调用由试用者在界面主动发起。更换 Key 后先运行 `./scripts/deploy stop`，再打开客户端并重新启用执行端。省略此步时可以体验登录、工作区、任务及收件箱等协作功能。 [DeepSeek 配置说明](https://api-docs.deepseek.com/zh-cn/api_samples/chat_curl/)

`open` 启动本产品的 PostgreSQL、Multica API 和 DSH Host，然后用默认浏览器打开登录页。注册新账号后，在「成员与智能体」启用本机执行端，再选择 Pi 新建智能体。可用智能体上的「测试模型调用」核对配置，随后把任务分派给它。若安装了 Codex，可在 Codex 智能体的模型设置里登录，授权保存于该执行端资料。

## 管理本地服务

```sh
./scripts/deploy open b
./scripts/deploy status
./scripts/deploy stop
```

- `open b` 打开第二个客户端，与默认的 A 共用本机协作服务。可用两个新账号演练邀请与任务交接。
- `start api` 单独启动 PostgreSQL 和 Multica API。稍后运行 `open` 可接入已有本机服务。
- `status` 查看本产品记录的四个进程。A/B Host 用回环端口 19016/19017，API 用 19015，数据库用 54359。收到端口占用提示时，先退出占用这些端口的旧试用实例。日志在 `.local/standalone/logs/`。
- `stop` 停止此部署登记的执行端、Host、API 和数据库。账号、文件、对话和任务保留在 `.local/standalone/`。更新代码后先停服务，再运行 `setup` 和 `open`。

浏览器版使用同一套协作服务和插件。原生菜单、系统文件选择器导入 Codex 登录和 SSH 信任对话框需要桌面客户端。每位同事的本机试用数据独立，A/B 协作是在同一台 Mac 的本地服务上体验。

## 重放验收

在安装了 Python Playwright 和 Google Chrome 的 Mac 上执行：

```sh
python3 tests/migration/source_deployment.py --output .local/source-deployment-evidence.json
```

测试重新准备独立运行目录，在隔离端口运行两个浏览器账号。工作台和实际 Pi CLI 都连接临时回环模型服务器。复验后停止这轮服务。[macOS Apple Silicon 回放结果](migration-evidence/regression/source-deployment.json)
