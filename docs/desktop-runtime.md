# 本机应用包与执行端复验

从 Finder 打开 `.local/v2-runtime/desktop/Team Workbench.app`。首次打开时应用会建立本产品的数据库、上传目录和 DSH 资料，启动本机服务并打开登录页。再次双击会显示当前窗口。红钮隐藏窗口，菜单中的退出命令结束客户端。下次登录仍可取回原账号持久保存的数据。

同一应用包用于所有业务账号。默认资料为 A，双实例复验可给另一次启动指定 B。菜单栏名称为「团队工作台」。安装包针对本机 Apple Silicon 生成，包含 Electron 35.7.5、Node、DSH、Multica CLI/API、PostgreSQL 及 pgvector、工作台 Pi 和产品插件。启动器使用系统 Python 3。本机文件签名为 ad hoc。数据目录由构建时的安装记录给出。该目录不可写时，在当前 macOS 账号的 Application Support 下建立 DSH Team Workbench 资料。

原生菜单翻译、SSH 首次信任、模型登录与本地关联处理沿用冻结客户端 `dbf36f4d2a9b69779c18cb5fec22ce3ee6302a69` 的 `application-menu-locale.mjs` 与 `mobilework/team-{remote,model-auth,personal}.mjs`。本产品把凭据与业务身份校验放进 DSH Host，将文件与信任对话框交给对应客户端。许可见[上游说明](../packages/ui-workspace-shell/assets/LICENSE.upstream)。

## 构建和启动

在产品仓执行以下命令。构建需要仓库 README 中列出的冻结源码、本机 PostgreSQL 工具、DSH 安装、Node 运行时及已缓存的冻结 Electron 压缩包。首次准备会编译 Multica。构建脚本校验 Electron 压缩包 SHA-256、签名、依赖软链接和敏感资料文件名。包中 `Contents/Resources/payload-audit.json` 记录该次检查。`Info.plist` 的 `WorkbenchBuild` 区分产品构建。

```sh
pnpm build
scripts/build-desktop
open '.local/v2-runtime/desktop/Team Workbench.app'
```

普通双击启动应用包内置的服务与 UI。A、B 协作共用回环 API 19015 和 PostgreSQL 54359，DSH Host 分别使用 19016、19017。两端测试实例使用不同客户端资料。切换业务身份的隔离检查在同一实例内退出并重登。源码开发命令 `scripts/local start` 会启动当前工作树的 Host。验收包自身时，先定向停止产品开发服务，然后从应用包启动。CLI 的运行目录、PID、启动时间和进程身份用于核对服务归属。

```sh
scripts/local stop
scripts/local open a --fixture --inspect-port 19883
scripts/local open b --fixture --inspect-port 19884
```

上述端口只在显式请求时开放本机回放。若同一资料的实例已经运行，先从该实例的系统菜单退出，再用带检查端口的命令打开。运行资料目录是 `.local/v2-runtime`。两个实例共享的服务和资料在退出窗口后保留，验收结束后可用 `scripts/local stop` 停止本产品的执行端、Host、API 和数据库。普通双击会按当前可用 CLI 登记执行端，每个业务账号使用独立配置目录。`--fixture` 使用本地确定性 Codex 协议程序，以及三个只报告工具目录的辅助程序。

## 模型与外部条件

工作台对话、重新回答和固定视图重新分析共用服务端模型。产品从运行资料目录的 `model.private.json` 读取 `baseUrl`、`model` 和 `apiKey`，文件权限为 0600。修改后重启本产品 API。普通启动缺少配置时，工作台显示「工作台模型尚未配置」。

任务起草、结论草稿、蓝图建议、模型探针和任务执行使用所选智能体绑定的执行端。结论和蓝图使用支持项目规划的 Pi 端。各本机业务账号的 CLI 配置位于客户端资料的 `daemons/<用户 ID>/` 下，由该账号的执行端读取。Codex 可从「成员与智能体」的模型设置登录或导入授权。模型探针和执行结果可分别核对。

自动复验须显式使用 `--fixture`，由回环 19019 模型服务和受控 CLI 响应。`--fixture` 检查产品配置与已运行 API 的模型模式。原生补充复验使用 `isolated-replay/` 下独立的数据库和上传资料。

### 2026-11-26 本机亲验配置

模型接入时的构建为 `34c92b4b`。工作台读取从 V2 恢复副本复用的官方 DeepSeek Flash 配置。在运行中的 A、B Host 分别用独立合成会话登录，填入输入框后核对模型可选和发送启用，随后清空输入。缺少模型配置的正常启动和显式回放两种状态另在独立资料核对。真实生成由用户触发。

亲验账号 `bear`、`dog` 在 A、B 各自拥有执行端资料。Pi 使用 DeepSeek Flash，覆盖任务起草、结论、蓝图及后续执行。Claude Code 使用 DeepSeek 的 Anthropic 兼容接口。OpenCode 使用其当前目录项 `deepseek/deepseek-v4-flash`。Codex 仍需在执行端的模型设置完成独立登录。正常执行端沿用 V2 的超时设置，45 秒上限只用于受控回放。外部 SSH 继续暂缓。

体验调整构建 `684f79d7` 将 Codex 认证状态和目录绑定到当前执行端。发现模型时读取该 CLI 的目录，重新发现可绕过 daemon 的内存缓存。见[本批回放](migration-evidence/regression/experience.json)。

## 原生补充复验

安装 Python Playwright 后，在本产品目录运行。前三条命令均通过 LaunchServices 打开上面同一个包，在 19115、19116、54459 的隔离现场操作，原生控件检查需要系统辅助功能权限。证据写入所给目录。脚本用合成账号，记录构建标识、观察值与截图。私钥选择器的复验点取消。SSH 协议用回环的临时主机密钥，远端状态回执由本地程序构造。

```sh
python3 tests/native/shell.py --output .local/v2-runtime/native-evidence
python3 tests/native/agents.py --output .local/v2-runtime/native-evidence
python3 tests/native/remote.py --output .local/v2-runtime/native-evidence
WORKBENCH_RUNTIME="$PWD/.local/v2-runtime/isolated-replay" WORKBENCH_TEST_LAB=1 \
  /usr/bin/python3 '.local/v2-runtime/desktop/Team Workbench.app/Contents/Resources/product/scripts/local' stop
```

`shell.json` 含五个菜单共 34 项、AppKit 菜单响应、红钮与进程、重新加载和缩放、退出与重开。`agents.json` 记录个人区执行端、运行时 ID、同名智能体、本机受控探针、跨客户端排队取消、离线修改角色说明、原生文件选择和取消、重启后的绑定及归档。`remote.json` 记录首次确认、相同或变更指纹、断开与凭据归属。运行日志、数据库与口令保存在私有资料目录。检查 Finder 无参数冷启动时，先从 A 实例菜单退出，再运行 `python3 tests/native/finder.py --output .local/v2-runtime/native-evidence`。
