# MobileWork V3

产品以 DSH Client 装配工作区、任务、成员、智能体小队和收件箱。DSH Host 管理本机连接、登录会话和执行端，[Multica](https://github.com/multica-ai/multica) 保存协作、计划版本、私人会话与执行回执。

[V3 首版开发与测试交接](docs/v3/首版交接.md) · [启动、测试与样例](docs/v3/运行与复验.md) · [逐项验收与差异](docs/v3/验收矩阵.md)

## 同事在 macOS 上试用

用具有组织仓库读取权限的账号克隆。需要 Git、Python 3 和 Homebrew。首次部署会下载并编译 Multica 服务端、准备 DSH Host 和本机执行端依赖，并安装浏览器客户端。

```sh
brew install node@24 go postgresql@18 pgvector
./scripts/deploy setup
./scripts/deploy model
./scripts/deploy open
```

`model` 用来输入试用者自己的 DeepSeek API Key。可以跳过并先体验注册、工作区和协作。浏览器打开后注册一个新账号，到 **账户菜单 → 运行时 → 启用本机执行端**，然后选择 Pi 新建智能体。查看服务和执行端说明见[本机部署与验证](docs/local-deployment.md)。

## 历史迁移和验收资料

- [V2 历史交付与验收入口](docs/migration-evidence/README.md)
- [冻结 Demo V2 桌面迁移基线](docs/demo-v2-baseline/README.md)
- [逐项差异与复验记录](docs/migration-evidence/matrix.md)
- [桌面包、运行资料、模型和回放配置](docs/desktop-runtime.md)
- [迁移任务书](docs/demo-v2-migration-brief.md) · [首批设计](docs/design.md) · [早期实施计划](docs/implementation-plan.md) · [首批 A1–A8 历史记录](docs/acceptance.md)

## 从冻结源码重建桌面包

独立克隆后，先准备以下源码和工具。源码版本由 [准备脚本](scripts/prepare-multica.sh) 校验。

| 环境变量 | 指向 |
|---|---|
| `WORKBENCH_V2_SRC` | 已安装冻结前端依赖的 V2 客户端 checkout |
| `WORKBENCH_MULTICA_SRC` | Multica 固定版本 checkout |
| `WORKBENCH_DSH_SRC` | DSH 固定版本 checkout |
| `WORKBENCH_DSH_BIN` | 本机 DSH CLI 可执行文件 |
| `WORKBENCH_PG_BIN` | PostgreSQL 工具的 `bin` 目录，安装需包含 pgvector |
| `WORKBENCH_STANDALONE_NODE` | 要随包部署的 Node 可执行文件 |

桌面构建还需要在 macOS Electron 缓存中准备 35.7.5 的本机架构归档。详细配置见[桌面运行说明](docs/desktop-runtime.md)。

```sh
pnpm install --frozen-lockfile
scripts/local prepare
pnpm build
pnpm check:types
pnpm test
scripts/build-desktop
```

## 复验

```sh
pnpm test:browser
```

浏览器回放会在专用工作台资料中注册合成账号、生成协作和执行记录，并在最后重启本产品的 Host 与 API，验证插件缺席、服务恢复和会话过期。请在完成手工操作后执行。原生回放与测试身份准备见[验收入口](docs/migration-evidence/README.md)。
