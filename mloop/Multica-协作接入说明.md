# Multica Desktop 协作接入

对方已经安装支持此配置的 Multica Desktop 时，修改用户目录里的配置文件，完全退出后重新打开即可连接本服务器。无需源码、重新打包、安装 CLI 或手动获取 PAT。

## 直接转交给对方大模型

```text
请帮我把本机已安装的 Multica Desktop 切换到下面的服务器：
https://api.multica.xymtop.com

操作步骤：
1. 找到当前用户目录下的 .multica/desktop.json。
   macOS：/Users/<用户名>/.multica/desktop.json
   Linux：/home/<用户名>/.multica/desktop.json
   Windows：C:\Users\<用户名>\.multica\desktop.json
   请根据本机当前用户的实际主目录定位，不要照抄用户名占位符。
2. 如果文件已存在，先保留一份原配置；目录不存在时创建目录。
3. 将 desktop.json 设置为以下 JSON：

{
  "schemaVersion": 1,
  "apiUrl": "https://api.multica.xymtop.com",
  "wsUrl": "wss://api.multica.xymtop.com/ws",
  "appUrl": "https://api.multica.xymtop.com"
}

4. 先保存桌面端未完成的内容，再完全退出 Multica Desktop，然后重新打开。
   仅关闭窗口或刷新页面不够。
5. 在桌面端使用本人的真实邮箱获取验证码并登录；验证码由我本人输入。
   这个流程不需要 PAT，不需要 CLI，也不需要服务器 SSH 权限。
6. 加入管理员邀请的 Multica Demo 工作区。
   如果没有邀请，把我的真实邮箱告诉管理员，请其邀请后再接受邀请。
7. 确认已进入该工作区，即可查看任务、评论和参与协作。

目标工作区：
名称：Multica Demo
slug：multica-demo
UUID：b884447d-a09a-4a84-82c2-b5c01ef32284
任务编号前缀：DEMO

只修改我本机的 Desktop 连接配置。不要修改服务器配置、其他用户的配置，
也不要把 CLI 的 config.json 当作 Desktop 配置文件。

如果需要让本机智能体接收协作任务，再确认我本机已安装并登录可用的 AI
编程工具。Desktop 会管理本地守护进程；在桌面端选取本机运行时创建智能体即可。
仅查看和管理任务不需要配置本机 AI 编程工具。
```

## 登录与工作区

对方使用自己的真实邮箱接收验证码。管理员邀请该邮箱加入 **Multica Demo**；注册账号本身不会自动加入这个已有工作区。

预置的 `admin@multica.test`、`member1@multica.test`、`member2@multica.test` 是体验账号，无法接收邮件，不用于外部协作者的邮箱登录。

服务器已部署后端和 Web 前端。网页登录地址为 https://api.multica.xymtop.com/login；管理员生成的 `/join?code=…` 邀请链接可以在浏览器打开，登录后加入工作区。被撤销或过期的链接需要管理员重新生成。Desktop 和浏览器分别登录。

## 恢复默认连接

恢复原配置，或者删除 `.multica/desktop.json`，完全退出再打开 Desktop。没有该文件时，客户端默认连接官方 Cloud：`https://api.multica.ai`。

Desktop 使用 `.multica/desktop.json`；CLI 使用 `.multica/config.json` 或 profile 配置。修改 CLI 配置不会修改 Desktop 的服务器。

以上配置适用于正式安装的 Desktop。源码开发模式使用 `VITE_API_URL` 等开发环境变量，是另一套配置来源。
