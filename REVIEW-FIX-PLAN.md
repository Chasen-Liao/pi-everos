# pi-everos 审查修复计划

> **用途**：交给后续 Agent 按项实现。  
> **基准提交**：`1849aa3`（`feat: ship pi-everos 0.1.0 with uvx MCP memory protocol`），相对 `origin/main` 的 `7c40772`。  
> **规格来源**：`Plan.md`（以正文要求为准，不以 Plan 里已勾选的里程碑为准）。  
> **审查日期**：2026-10-19  

## 背景

对 `1849aa3` 做了安全、标准、规格三轴审查。**凭据不落盘、logout 不删系统 key、不自动改 `mcp.json`** 等核心安全约束已满足。本计划只列**仍需修复**的缺口与建议实现方式。

## 目标与非目标

| 做 | 不做 |
| --- | --- |
| 修审查中的 P0/P1 行为与 Plan 不一致项 | npm 发布、打 git tag、改用户本机 `mcp.json` |
| 补单元测试（替换仅 grep 源码的弱测试） | 实现 OAuth 远程 MCP 默认路径 |
| 更新 README / schema / 必要时 `Plan.md` 勾选与文案一致 | 全量 i18n 框架（v1 只需 Plan 承诺的文案覆盖） |

## 建议实施顺序

```text
R1 (P0 安全) → R2 (P1 mcp.json 覆盖语义) → R3 (P1 提示截断) → R4 (P1 cwd/凭据重连)
→ R5 (P2 D5 工具前缀) → R6 (P2 配置/schema) → R7 (P2 文档与 i18n) → R8 (清理)
```

每项完成后跑：`npm test`。涉及扩展行为的项在真实 `pi` 里抽测（见文末验收清单）。

---

## R1 · Plan 模式写工具拦截缺口（P0 · 安全）

**问题**  
`extensions/index.ts` 的 `tool_call` 仅用 `isPlanMode(ctx.sessionManager.getBranch())`（`src/guard.ts`）。Pi 以 `--plan` 启动时，官方 plan 扩展可能尚未写入 `customType: "plan-mode"` 的 session entry，此时 `add_memory` / `forget_session` / `record_trajectory` 仍可调。

**Plan 引用**  
§8 M4：「plan 模式只读：拦截 `add_memory` / `forget_session` / `record_trajectory`」。

**建议实现**

1. 在 `src/guard.ts` 增加 `isPlanModeActive(entries, planFlag?: boolean): boolean`：
   - `true` 当**任一**成立：最新 branch 上 `plan-mode` entry 的 `data.enabled === true`；或 `planFlag === true`（来自 Pi API）。
2. 在 `extensions/index.ts` 的 `tool_call` 中传入 plan 信号。实现前在 `@earendil-works/pi-coding-agent` 1.3.x 文档或类型里确认 API，优先级：
   - `pi.getFlag("plan")`（若 plan 扩展注册了该 flag）；
   - 或 extension 可订阅的 plan 相关事件 / context；
   - 若 API 不可用，在 `REVIEW-FIX-PLAN.md` 本项下记「阻塞原因」并改为在 `session_start` 读 `ctx` 上可用字段。
3. **保留**「最新 entry `enabled: false` 且处于 execute 计划阶段仍允许写」若与官方 plan-mode 一致；仅补「entry 尚未存在但 plan 已开」的冷启动路径。

**测试**

- `tests/guard.test.mjs`：`isPlanModeActive([], true)` 为 true；`([], false)` 与 entry 逻辑组合用例。
- 删除或收窄 `planModeBlock` 若与 `planBlockReason` 重复（见 R8）。

**验收**

- 冷启动 `--plan` 下调用 `mcp__everos__add_memory` 被 block，reason 走 `planBlockReason`（`src/text.ts`）。

---

## R2 · `mcp.json` 的 `everos` 仅在 **enabled** 时让路（P1）

**问题**  
`readFileEverosServer()`（`src/mcp.ts:39`）在条目存在时一律 `overridesExtension = true`，含 `enabled: false`。用户按 Plan §6 禁用条目后仍注册 `everos-pi`，doctor 文案与行为矛盾。

**Plan 引用**  
§6：「禁用或改名该条目……再 `/reload`」；§2 D3/M2：被占用时用 `everos-pi` 让路。

**建议实现**

```ts
// 语义建议
info.overridesExtension = entry.enabled !== false; // 仅 enabled 的 everos 占用名
```

连带修改：

| 位置 | 调整 |
| --- | --- |
| `projectServerName` / `ownedServerNames` | 仅 `overridesExtension` 时用 `SPIKE_SERVER` |
| `extensions/index.ts` `overrideWarning` | 仅 `present && enabled` 时提示抢占 |
| `src/commands.ts` doctor notes | 区分：`present+enabled` → 改名/禁用；`present+disabled` → 扩展应已拥有 `everos` |
| `buildEverosSection` 的 `overrideWarning` | 同上 |

**测试**

- 新测：`tests/mcp.test.mjs`（或扩展现有）mock `mcp.json`：`everos` disabled → `overridesExtension === false`，`projectServerName` → `everos`。

**验收**

- `mcp.json` 中 `everos: { enabled: false }` 时 `/mcp` 显示插件注册的 `everos`（非 `everos-pi`），doctor 不再要求「禁用后才能拥有 everos」。

---

## R3 · 默认 200 token 提示不能裁掉安全句（P1）

**问题**  
`buildEverosSection`（`src/prompt.ts`）先拼长文案再 `clip(..., maxTokens * 4)`。七工具全开时约在 800 字符处截断，`forget_session` 确认与「别记」句落在截断之后。`tests/prompt.test.mjs` 只 grep 源码，不验证运行时长度。

**Plan 引用**  
§5 提示原则：`forget_session` 须先确认；「拒绝保存」边界；默认约 200 tokens。

**建议实现（二选一或组合）**

1. **优先级裁剪（推荐）**：把「必保留」行标为 `priority: high`（至少：`forget` 确认行、`If the user says not to remember`、不可用时的单行降级）。`clip` 时先保留 high，再裁 low。
2. **缩短默认文案**：合并 scope 说明，使默认 200 token 下完整包含 high 行。
3. 可选：`prompt.customText`（见 R6）非空时替换自动生成段，仍受 `maxTokens` 限制。

**测试**

- `tests/prompt.test.mjs`：对 `buildEverosSection` **调用**，`maxTokens: 200`，七工具 mock 名，断言输出包含 `confirmed` 与 `not to remember`（或中文等价若 R7 做了 i18n）。

**验收**

- 默认设置下注入的 `sections.everos` 含 forget 确认与拒绝保存说明（可用 `node -e` 或测试断言）。

---

## R4 · 工作区切换与凭据刷新（P1）

### R4a · `cwd` 变化后 MCP `EVEROS_PROJECT_ID` 未更新

**问题**  
`extensions/index.ts`：`session_start` 在 `creds.present` 为 true 时不再 `registerServers()`；`cwd` 更新但项目 MCP env 仍指向旧 `process.cwd()` 注册值。`autoProjectId` 仅用 `basename(cwd)`，同名目录会碰撞（Plan 已知风险，至少在 doctor/scope 提示）。

**Plan 引用**  
§4 作用域是 env；§11 `projectId: "auto"` 由工作区派生。

**建议实现**

1. 在 `session_start`（或 Pi 提供的 cwd 变更事件，若有）比较 `ctx.cwd` 与上次 `cwd`：
   - 若变化且 `settings.enabled && creds.present`：`unregisterServers()` → `registerServers()`。
2. `registerEverosCommand` 的 `setCwd` 已在 command handler 调用；扩展侧 `cwd` 与 `session_start` 保持单一来源。
3. **文档/scope 输出**：`auto` 时注明「derived from directory basename」；可选后续用路径 hash（**非 v1 必须**，可写 TODO）。

### R4b · `/everos login` 与 `reconnect` 不重新读 key

**问题**  
`resolveCredentials()` 仅在 `session_start` 且 `!creds.present` 时调用。用户按 doctor 设置用户环境变量后，`login` 只打印说明；`reconnect` 复用旧 `creds`。

**建议实现**

- `reconnect`：`creds = resolveCredentials()`（或 deps 上 `refreshCreds()`），再 `registerServers()`。
- `login`：在打印说明后可选调用一次 `resolveCredentials()`，若 present 则 `enabled: true` + `registerServers()` 并提示成功（仍不写 everos.json）。
- `extensions/index.ts` 暴露 `setCreds` 或通过 `CommandDeps` 回调更新闭包内 `creds`。

**测试**

- 对 `resolveCredentials` 用 mock/spy 的轻量测试，或 commands 层注入 fake `refreshCreds`。

**验收**

- 启动无 key → 设置用户 env（不重启）→ `/everos reconnect` 后 status 显示 key 来源非 missing。

---

## R5 · 工具错误提示符合 D5（P2）

**问题**  
`tool_result`（`extensions/index.ts:101`）使用 `startsWith("mcp__everos")`，漏掉 `mcp__everos_global__*` 等，也与 D5「不硬编码前缀」不一致。

**建议实现**

- 复用 `allOwnedToolNames(pi, ownedServerNames(fileServer))` 或 `isMutatingMemoryTool` 的 server-agnostic 后缀判断：任意 owned server 的 EverOS 工具（可用 `everosToolNames` 合并列表）匹配 `event.toolName`。
- 删除未使用的 `allOwnedToolNames` 若仍无引用，或在本项真正使用它。

**验收**

- 全局连接工具报错时仍只 notify 一次（与现行为一致）。

---

## R6 · 设置 schema 校验与可编辑提示（P2）

**问题**

- `loadSettings` 无 JSON Schema 校验（Plan §5 `config.ts` 职责）。
- Plan §3「可编辑的系统提示」仅有 `enabled` / `maxTokens`。

**建议实现**

1. **Schema 校验**：`package.json` 已有 `typebox` peer。用 TypeBox 从 `schemas/everos.schema.json` 生成或手写等价 `Type`，`loadSettings` 解析后 `Value.Check`；失败时 log（经 `redact`）并回退 `DEFAULT_SETTINGS` 或拒绝写入（选一种并写进测试）。
2. **`prompt.customText?: string`**（可选空）：非空时作为 `sections.everos` 主体或追加在协议后；更新 `everos.schema.json`、`DEFAULT_SETTINGS`、`saveSettings`。
3. `loadSettings` 对 `userId` / `projectId` 等可用 `isValidScopeId`（auto 除外）在 load 时校验（Plan §9 风险表提及）。

**测试**

- `tests/config.test.mjs`：非法 JSON、非法 `maxTokens`、含 `apiKey` 字段被拒绝或剥离。

**验收**

- 损坏的 `everos.json` 不会静默写成奇怪状态；schema 仍 `additionalProperties: false`。

---

## R7 · 文档与双语（P2）

**问题**

- Plan §3「中英双语文案」：仅 plan 拦截与少量 `t()` 启动警告；协议、doctor、`/everos` 多为英文。
- Plan §6：`logout` 行为 README 未写清（代码已对）。

**建议实现**

1. **README**：`logout` 不删系统 `EVEROS_API_KEY`；`mcp.json` 禁用 vs 改名的区别（与 R2 一致）。
2. **i18n 范围（务实）**：扩展 `src/text.ts` 的 key 覆盖：`/everos` 子命令用户可见字符串、doctor 块标题、协议注入的**短**降级句（完整协议可暂保持英文，或在 `PI_LANG=zh` 时提供等价短版）。不必引入 gettext。
3. 若 R3 保留英文协议，在 Plan 或 README 注明「协议段默认英文，命令与 doctor 跟随 `PI_LANG`」。

**验收**

- `PI_LANG=zh` 下 `/everos logout` 与 doctor 标题为中文；README 与 R2 行为一致。

---

## R8 · 小清理（P3）

| 项 | 动作 |
| --- | --- |
| `planModeBlock` vs `planBlockReason` | 删除未使用的 `planModeBlock` 或让测试统一走 `planBlockReason` |
| `resolveUvx().available` | 恒 true 且无读者 → 删除字段或改为 `onDisk` 别名并更新调用方 |
| `scripts/m1-*.mjs` / `m3-isolation.mjs` 重复 `resolveUvx`/`send` | 可选抽到 `scripts/_lib.mjs`（非阻塞发布） |
| `Plan.md` | 本修复批次完成后，仅更新与**实际行为**一致的勾选与 §6 禁用语义 |

---

## 文件触达一览

| 文件 | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `extensions/index.ts` | ✓ | ✓ | | ✓ | ✓ | | | |
| `src/guard.ts` | ✓ | | | | | | | ✓ |
| `src/mcp.ts` | | ✓ | | | ✓ | | | ✓ |
| `src/prompt.ts` | | | ✓ | | | ✓ | | |
| `src/config.ts` | | | | | | ✓ | | |
| `src/commands.ts` | | ✓ | | ✓ | | | ✓ | |
| `src/text.ts` | | | | | | | ✓ | |
| `schemas/everos.schema.json` | | | | | | ✓ | | |
| `README.md` | | ✓ | | | | | ✓ | |
| `tests/*.mjs` | ✓ | ✓ | ✓ | ✓ | | ✓ | | ✓ |

---

## 回归验收清单（人工）

1. `npm test` 全绿；`prompt` 测试必须断言运行时字符串，不能仅 `readFileSync` grep。
2. `mcp.json` 三条路径：`everos` 不存在 / `enabled:true` / `enabled:false` → 服务器名与 doctor 文案正确。
3. Plan 模式：`--plan` 冷启动 block 写工具；`/plan` 关闭后写工具恢复（若本机有 plan 扩展）。
4. 换目录开新会话或触发 `session_start`：`projectId auto` 与 MCP env 一致。
5. 设置用户 env 后 `/everos reconnect` 无需重启 Pi。
6. `everos.json` 全文搜索无 `apiKey`、无完整 key；doctor 输出仍经 `redact`。

---

## 参考：审查已确认无问题的安全项

- D4：API key 不进 `everos.json`；进程 env 用 `${EVEROS_API_KEY}` 占位注入。
- `/everos logout`：仅 `enabled: false` + unregister，不删 OS 凭据。
- 不自动编辑 `~/.pi/agent/mcp.json`。
- `redact` / doctor 报告掩码；工厂不 `spawn`（凭据读取在 `session_start` / commands）。

---

## 交付物

1. 上述 R1–R8 中 P0/P1 全部完成；P2 按时间至少 R5–R6。
2. 在本文件末尾追加 **「实施记录」** 小节：完成项、API 假设（如 `pi.getFlag`）、未做项与原因。
3. 可选：`CHANGELOG.md` 一条 `Unreleased` / patch 说明。

---

### 实施记录

（由执行 Agent 填写）

```text
日期：2026-10-19
完成：R1–R8（脚本 _lib 抽取未做）
阻塞：无。plan 信号使用 pi.getFlag("plan") === true，外加最新 plan-mode session entry。
备注：协议段保持英文；命令/doctor 标题跟随 PI_LANG。未做真实 --plan 人工抽测。
```
