# pi-everos

EverOS Cloud 的 Pi Agent 插件。把记忆协议注入每次运行，让模型主动检索和保存经验；通过 OAuth 登录一次，自动注册 MCP 并在重启后恢复连接。

当前处于规划阶段，功能尚未实现。实施细节见 [Plan.md](./Plan.md)。

## 计划中的安装方式

```bash
pi install ./pi-everos
```

## 计划中的命令

```text
/everos status
/everos login
/everos logout
/everos scope
/everos reconnect
/everos doctor
```

## 已知限制

- 远程 OAuth connector 提供 5 个记忆工具，不含轨迹与 Agent 经验工具。
- 完整 7 工具模式需要本地 `uvx everos-mcp` 运行时。

