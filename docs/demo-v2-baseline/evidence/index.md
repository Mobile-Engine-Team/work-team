# 原版证据索引

以下 40 张 PNG 均取自 2026-11-26 隔离运行的冻结 Electron 页面。角色是截图发生时的观察者，截图只证明该帧显示的状态。异步结果、点击后发生的业务写入、焦点和第二客户端所见另查[控件树](observations.json)及[数据库快照](business-results.json)。

| 图 | 身份 | 画面与检查点 | 条目 |
|---:|---|---|---|
| [01](01-login.png) | — | 新资料的密码登录与主按钮 | [AU-01](../01-启动与工作区.md#au-01) |
| [02](02-personal.png) | A | 注册后的个人首页 | [AU-03](../01-启动与工作区.md#au-03)、[WB-01](../05-工作台与依据.md#wb-01) |
| [03](03-workspace-empty.png) | A | 新建工作区空表与禁用按钮 | [WS-03](../01-启动与工作区.md#ws-03) |
| [04](04-workspace-invalid.png) | A | 非法地址提交后的通用错误 | [WS-08](../01-启动与工作区.md#ws-08) |
| [05](05-team-home.png) | A | 新团队落点和侧栏 | [WS-09](../01-启动与工作区.md#ws-09) |
| [06](06-workspace-duplicate.png) | A | 重复地址后的错误与保留值 | [WS-10](../01-启动与工作区.md#ws-10) |
| [07](07-agent-team.png) | A | 团队新建助手及共享选项 | [AG-02](../02-成员与执行.md#ag-02) |
| [08](08-agent-personal.png) | B | 个人新建助手，无团队共享选项 | [AG-01](../02-成员与执行.md#ag-01) |
| [09](09-invite.png) | B | 账号级邀请、接受与稍后处理 | [IN-02](../01-启动与工作区.md#in-02) |
| [10](10-shared-agent-member.png) | B | 他人共享助手卡及权限 | [AG-08](../02-成员与执行.md#ag-08) |
| [11](11-task-new.png) | A | 普通新建任务默认值与字段顺序 | [TK-01](../03-任务与协作.md#tk-01) |
| [12](12-task-draft.png) | A | 切换智能体起草后的字段 | [TK-07](../03-任务与协作.md#tk-07) |
| [13](13-task-detail.png) | A | 创建后的任务详情和输入文件 | [TK-05](../03-任务与协作.md#tk-05) |
| [14](14-member-inbox.png) | B | 收件箱的新指派 | [IB-01](../03-任务与协作.md#ib-01) |
| [15](15-file-preview.png) | A | 任务输入附件正文 | [FL-02](../03-任务与协作.md#fl-02) |
| [16](16-task-after-reload.png) | B | 刷新后的任务、讨论和材料 | [STATE-01](../06-已有用户与裁决.md#state-01)、[STATE-05](../06-已有用户与裁决.md#state-05) |
| [17](17-project-new.png) | A | 新建项目表单 | [PJ-01](../04-项目与蓝图.md#pj-01) |
| [18](18-project.png) | A | 新项目总览 | [PJ-02](../04-项目与蓝图.md#pj-02) |
| [19](19-conclusion.png) | A | 整理结论弹窗 | [TC-01](../04-项目与蓝图.md#tc-01) |
| [20](20-blueprint.png) | A | 带已确认话题进入施工蓝图 | [TP-03](../04-项目与蓝图.md#tp-03) |
| [21](21-blueprint-node.png) | A | 编辑节点和右侧字段 | [BP-03](../04-项目与蓝图.md#bp-03) |
| [22](22-publish-preview.png) | A | 变更与发布预览 | [BP-12](../04-项目与蓝图.md#bp-12) |
| [23](23-start-preview.png) | A | 正式 V1 的不可推进原因 | [ST-01](../04-项目与蓝图.md#st-01) |
| [24](24-squad.png) | A | 创建后的小队及队长 | [SQ-03](../02-成员与执行.md#sq-03) |
| [25](25-generating.png) | A | 本机延迟端等待中，可停止 | [WB-05](../05-工作台与依据.md#wb-05) |
| [26](26-stopped.png) | A | 已停止生成，可重新回答 | [WB-06](../05-工作台与依据.md#wb-06) |
| [27](27-evidence.png) | A | 已存回答的依据弹窗 | [WB-13](../05-工作台与依据.md#wb-13) |
| [28](28-pin.png) | A | 固定视图和过期刷新 | [WB-09](../05-工作台与依据.md#wb-09)、[WB-10](../05-工作台与依据.md#wb-10) |
| [29](29-board.png) | B | 任务看板布局、列及计数 | [TL-04](../03-任务与协作.md#tl-04) |
| [30](30-remote.png) | A | 远程主机弹窗，不发起 SSH | [EP-04](../02-成员与执行.md#ep-04) |
| [31](31-history.png) | A | 同任务聚合的此前通知 | [IB-01](../03-任务与协作.md#ib-01)、[IB-02](../03-任务与协作.md#ib-02) |
| [32](32-cold-start.png) | B | 真正退出后同资料重开的登录页 | [STATE-01](../06-已有用户与裁决.md#state-01) |
| [33](33-trigger-preview.png) | B | 状态变更前预估，暂不开始与确认并开始分列 | [RUN-01](../03-任务与协作.md#run-01) |
| [34](34-offline-dispatch.png) | B | 业务进行中、本人执行排队中 | [RUN-02](../03-任务与协作.md#run-02) |
| [35](35-cancel-run.png) | B | 停止后业务状态和执行状态分别显示 | [RUN-04](../03-任务与协作.md#run-04) |
| [36](36-before-restart.png) | B | 退出前留未读通知 | [STATE-06](../06-已有用户与裁决.md#state-06) |
| [37](37-queue-restart.png) | B | 重开重登录后仍能看到排队 | [STATE-07](../06-已有用户与裁决.md#state-07) |
| [38](38-dynamic.png) | A | 人工已完成 A2UI 快照的七条记录 | [WB-14](../05-工作台与依据.md#wb-14) |
| [39](39-delivery.png) | B | v2 单列、v1 置于历史版本 | [FL-05](../03-任务与协作.md#fl-05)、[FL-06](../03-任务与协作.md#fl-06) |
| [40](40-blueprint-conflict.png) | B | 同一节点字段冲突：两版文字与选择前禁用的合并按钮 | [BP-15](../04-项目与蓝图.md#bp-15) |

[图片尺寸与 SHA-256](images.json)。观察记录的键多为条目号；后缀 a/b/c 表示同条的不同操作阶段，ROLE-admin/HOME-admin 为临时管理员夹具，BP-13b、ST-02b 为正式版与接收方观察。焦点若为页面容器，记录显示其文字摘要。合成身份、内容保留，口令与机器识别信息作最小处理。

## 历史与源码的定位

| 标记 | 日期和范围 | 能证明的内容 |
|---|---|---|
| [H01](../../../../../work/IDEA-001/demo-versions/v2-20261117/verification.json) | 11/17 冻结核验 | 142 表、源码和运行物冻结检查，通过的定向回归及遗留诊断。 |
| [H02](../../../../../work/IDEA-001/demo-versions/v2-20261117/RESTORE.md) | 11/19 同机恢复 | 24 个附件文件校验、两个原身份重新登记、16 条运行时上线和 5 个旧绑定一致。没有新模型调用。 |
| [H03](../../../../../.local/demo-v2/src/multica/.local/v2-evidence/personal-execution.json) | 11/15 个人区历史执行 | 两个个人 Pi 样本曾完成；不证明本轮共享离线队列能被领取。 |
| [H04](../../../../../.local/demo-v2/src/multica/.local/v2-evidence/final-state-check.json) | 冻结前工作台验收 | 历史私人工作台、固定视图修订及刷新；不代替本轮真实模型结果。 |
| [H05](../../../../../.local/demo-v2/ux-five-20261117/verification-summary.json) | 11/17 界面定向验收 | 38 项测试、111 个断言、原生宽窄布局、无模型调用以及三条既有类型诊断。 |

H05 的[原生依据记录](../../../../../.local/demo-v2/ux-five-20261117/native-evidence-results.json)、[补充类型](../../../../../.local/demo-v2/ux-five-20261117/native-extra-evidence-results.json)及[项目原生记录](../../../../../.local/demo-v2/ux-five-20261117/native-projects-results.json)保留在同机私有目录。源码基点为[客户端 domains](../../../../../.local/demo-v2/src/mobile-work-client/apps/app/src/react-app/domains)、[桌面壳](../../../../../.local/demo-v2/src/mobile-work-client/apps/desktop/electron/main.mjs)、[服务端 handler](../../../../../.local/demo-v2/src/multica/server/internal/handler)、[service](../../../../../.local/demo-v2/src/multica/server/internal/service)。私有路径在另一台机器上须按恢复说明准备。另见[原生菜单逐项复验](native-menu.md)及[macOS 实测记录](native-menu.json)。
