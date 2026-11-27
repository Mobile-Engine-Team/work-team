# 本地运行

此目录是 CopilotKit 官方 `examples/showcases/a2ui-playground` 的独立副本，保留官方界面、组件和生成实现。来源：
https://github.com/CopilotKit/CopilotKit/tree/main/examples/showcases/a2ui-playground

```sh
cd /Users/xymtop/Desktop/mc/mloop/design-v3/copilotkit-a2ui
pnpm install --frozen-lockfile
pnpm dev
```

地址：http://localhost:3100/

`.env.local` 已将默认连接槽指向 DeepSeek（`https://api.deepseek.com/v1`，模型 `deepseek-flash`）。选择器默认显示 DeepSeek Flash。GPT 槽已通过 `DISABLED_MODELS=gpt` 关闭。
