# 双客户端原生复验

本流程通过 LaunchServices 打开迁移版的同一份 `Team Workbench.app`。A、B 分别使用专用测试资料。流程内另在 A 的同一份资料切换 A→B→A，核对私人草稿、对话、固定视图以及已授权的团队任务。

## 重放

在产品仓根目录操作。准备 Python 3.11+、Playwright for Python 及 Pillow。确认测试端口 `19015–19017`、`54359`、`19883–19884` 的占用归属，退出已经打开的此产品测试窗口。原生复验使用 bundle 内的服务。开发 Host 已运行时，执行 `scripts/local stop` 结束本产品记录的测试进程，再从应用启动。

```sh
python3 tests/migration/replay.py
```

脚本先用 `scripts/local open a --fixture --inspect-port 19883` 与 `scripts/local open b --fixture --inspect-port 19884` 启动应用。两个进程使用同一个产品包，运行时检查 A/B 的 DSH profile、PostgreSQL 和 API 指向该包。每次自动注册两个新账号和一个新团队，随机密码只写在终端输出的本机私有运行目录，合成数据保留在产品测试库。默认完成后关闭测试窗口。需要在同一窗口继续测项目和工作台时，可加 `--keep-windows`。

浏览器回归可运行 `python3 tests/migration/replay.py --browser`，使用 Chromium 的两个隔离上下文并连接同一产品的 DSH Host。Chrome 通过 `channel=chrome` 启动。命令会打印本次结果目录。要对新一次的结果生成对照页面，可执行下面命令，把第一个路径替换为本次结果目录。

```sh
python3 tests/migration/compare.py .local/migration-replays/本轮目录/evidence --output .local/migration-replays/本轮目录/对照.html
```

[交付构建的逐步结果](native/results.json) 给出构建标识、角色、运行条件和业务断言。PNG 图号对应[冻结图册](../demo-v2-baseline/evidence/index.md)。对照工具保留两张原始 PNG，根据各自嵌入的 ICC 转成 sRGB 后统计色差。不同合成账号、主机、任务编号、时间和列表快照会产生自然变化。

## 交互与持久化

- A 注册后用三种方式关闭工作区表单，重开、校验、重复提交并邀请 B。B 稍后处理、重载、接受后手动切入团队。团队成员归属和重复地址数从本次数据库回读。
- 分别打开个人与团队智能体表单，A 使用受控本机端手选 Codex 模型，切 Pi 后默认模型复位。保存私有助手时 B 看不到，改共享后 B 能使用且没有编辑入口。SSH 表单只检查本机可达控件。
- A 给 B 分派任务并上传 16 字节文本，B 经通知进入任务，回复、改状态并两次交付同名不同内容的文件。A 经 UI 下载原文件后计算 SHA-256。回读任务、执行数、附件大小和版本来源，核对 B 读到了同一任务。
- 离线时分别检查“暂不开始”和“确认并开始”。B 真退出进程并重登录，核对未读、排队、停止与重试。在线时真实 Multica 守护进程领取任务，本机 Codex 协议夹具返回固定正文，数据库记录责任人、开始和完成。
- 额外样本包含失联/恢复、创建回包丢失、上传失败三种恢复、分页 50/50/2、临时管理员、评论链接和小队协作。智能体起草样本用本轮登记的离线 Pi 端短时模拟在线心跳，通过实际起草接口存储请求并观察前端轮询。模拟的完成结果与取消状态由专用数据库条件构造，随后恢复旧心跳。真实模型内容和外部 SSH 由 D-08 暂缓。
