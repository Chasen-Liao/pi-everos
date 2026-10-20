# Changelog

## 0.2.0

- 注入独立的 `everos-agent` 协议段：模型在非平凡任务前召回 case/skill，超过三轮工具调用后记录完整轨迹；蒸馏仍在 EverOS Cloud。
- 可选 `assistantSenderId`（默认 `assistant-<userId>`）；`/everos status` 与 doctor 展示身份、record/recall 是否在线、质量门与 forget 保留 skill。
- README 增加官方仓 [`pi/`](https://github.com/EverMind-AI/Plugins/tree/main/pi) 入口，并补充 [MAINTENANCE.md](./MAINTENANCE.md)。

## 0.1.2

- README 截图改为 `/everos doctor` 与命令面板。

## 0.1.1

- Plan 冷启动也拦截记忆写入（`--plan` flag + session entry）。
- `mcp.json` 仅在 `everos` **启用**时让路；禁用后插件占用 `everos`。
- 默认提示保留 forget 确认与「别记」句；cwd 变化与 reconnect 会刷新项目 id / key。
- 命令/doctor 跟随 `PI_LANG`；设置校验会剥离 `apiKey`。

## 0.1.0

- 默认用 `uvx everos-mcp` + `EVEROS_API_KEY` 注册 `direct` MCP。
- 注入记忆协议；双连接（项目 + global）。
- `/everos status|login|logout|scope|reconnect|doctor`。
- plan 模式拦截记忆写入；doctor 可复制诊断块；设置文件不存 key。
