# 源码部署使用的依赖

- `multica.patch` 是从 Multica 上游提交 `7a12304f1473c71e0cee970c773246eaf96abc49` 到冻结 Demo V2 提交 `a7859a4715fd589d9460512ad805588210a5f0c5` 的服务端差异。准备脚本验证上游源码归档，应用补丁并加入现有产品的回环绑定及模型目录刷新调整，然后在本机编译。 [Multica](https://github.com/multica-ai/multica)
- `renderer.tar.gz` 含五个 DSH 浏览器插件的 `dist/client.js` 和对应第三方声明，由 `pnpm build` 使用冻结客户端 `dbf36f4d2a9b69779c18cb5fec22ce3ee6302a69` 生成。修改页面后用冻结构建环境重新生成并保存这份归档。
- `package.json` 和 `package-lock.json` 锁定首次部署使用的 DSH CLI 和 pnpm。工作台和 Pi 的依赖从各自的锁文件安装。

保留上游 [客户端许可](../packages/ui-workspace-shell/assets/LICENSE.upstream)、[Multica 许可](../packages/ui-workspace-shell/assets/LICENSE.multica)和 [Multica NOTICE](../packages/ui-workspace-shell/assets/NOTICE.multica)。API Key、数据库及账号资料由试用者的本机创建，位于 Git 忽略的 `.local/standalone/`。
