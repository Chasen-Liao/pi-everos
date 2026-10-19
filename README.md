# pi-everos

EverOS Cloud 的 Pi Agent 插件。安装后自动注册 `uvx everos-mcp`，并把记忆协议注入每次运行，让模型主动检索和保存。

需要本机已有 [uv](https://docs.astral.sh/uv/) 和 `EVEROS_API_KEY`。

## 安装

```bash
pi install D:/MyProjects/pi-everos
```

若 `~/.pi/agent/mcp.json` 里已有名为 `everos` 的服务器，文件配置会覆盖插件。先删掉或改名该条目，再启动 Pi。

## 命令

```text
/everos status
/everos login
/everos logout
/everos scope
/everos reconnect
/everos doctor
```

登录不会把 API key 写入 `everos.json`。把 `EVEROS_API_KEY` 设成用户环境变量后 `/everos reconnect` 或重启 Pi。

## 作用域

- 项目连接：当前工作区（`projectId: auto` 时用目录名）
- 全局连接：`everos-global`（默认 `global`）
- `/everos scope auto|project <id>|global <id>` 可改映射

## 开发

```bash
npm test
pi -e ./extensions/index.ts
```

架构见 [docs/architecture.md](./docs/architecture.md)，实施记录见 [Plan.md](./Plan.md)。

## 限制

- 默认是 `uvx everos-mcp` + API key，7 个工具。
- 远程 OAuth MCP 不是 v1 默认。
- plan 模式会拦截 `add_memory` / `forget_session` / `record_trajectory`。
