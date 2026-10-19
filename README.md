# pi-everos

EverOS Cloud 的 Pi Agent 插件。安装后自动注册 `uvx everos-mcp`，并把记忆协议注入每次运行，让模型主动检索和保存。

需要本机已有 [uv](https://docs.astral.sh/uv/) 和 `EVEROS_API_KEY`。

记忆协议段默认英文（受 `prompt.maxTokens` 限制）。`/everos` 命令与 doctor 标题跟随 `PI_LANG`/`LANG`（`zh` 用中文）。

## 安装

```bash
pi install D:/MyProjects/pi-everos
```

若 `~/.pi/agent/mcp.json` 里已有**启用的** `everos` 条目，文件配置会覆盖插件，插件改用 `everos-pi`。把该条目 `enabled: false` 或改名后 `/reload`，插件即可占用 `everos`。插件不会改 `mcp.json`。

## 命令

```text
/everos status
/everos login
/everos logout
/everos scope
/everos reconnect
/everos doctor
```

- 登录不把 API key 写入 `everos.json`。设好用户环境变量后 `/everos login` 或 `/everos reconnect` 会重新读 key。
- `/everos logout` 只断开本插件并写入 `enabled: false`，**不删除**系统里的 `EVEROS_API_KEY`。

## 作用域

- 项目连接：当前工作区（`projectId: auto` 时用**目录名**）
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
