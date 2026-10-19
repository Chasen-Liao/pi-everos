# Changelog

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
