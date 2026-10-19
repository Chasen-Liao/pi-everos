# Architecture

```text
pi install → extensions/index.ts
  → everos.json
  → 若 mcp.json 占用 everos：注册 everos-pi + everos-global
  → 否则：注册 everos + everos-global（uvx everos-mcp, exposure=direct）
  → before_agent_start 写入 sections.everos
  → 模型调用 mcp__everos* / mcp__everos_global*
```

| 模块 | 职责 |
| --- | --- |
| `extensions/index.ts` | 注册 MCP、命令、plan 拦截、提示注入 |
| `src/config.ts` | `~/.pi/agent/extension-settings/everos.json` |
| `src/mcp.ts` | uvx 配置、同名覆盖、工具名 |
| `src/prompt.ts` | 按项目/全局工具裁剪协议 |
| `src/scope.ts` | `project_id` 从 cwd 派生 |
| `src/credentials.ts` | 只读 API key，不写设置文件 |
| `src/commands.ts` | `/everos` |
| `src/guard.ts` | plan 模式只读 |
| `src/redact.ts` | 密钥掩码 |
| `src/report.ts` | doctor 可复制块 |

工厂里不 `spawn`。凭据只从环境读取。Pi 的 `mcp.json` 同名条目优先于插件注册。
