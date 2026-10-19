import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";

function resolvePi() {
  if (process.platform !== "win32") return { command: "pi", shell: false };
  const result = spawnSync("where", ["pi"], { encoding: "utf8", windowsHide: true });
  const lines = result.stdout?.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) ?? [];
  const cmd = lines.find((line) => line.toLowerCase().endsWith(".cmd"));
  return { command: cmd || "pi.cmd", shell: true };
}

const pi = resolvePi();
const child = spawn(
  pi.command,
  ["--mode", "rpc", "--no-session", "--no-skills", "--approve", "-e", "./extensions/index.ts"],
  {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env: process.env,
    shell: pi.shell,
  },
);

const toolCalls = [];
const toolResults = [];
let settled = false;
let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString("utf8");
});

const rl = createInterface({ input: child.stdout });
const waiters = new Map();

rl.on("line", (line) => {
  if (!line.trim()) return;
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    return;
  }
  if (parsed.id && waiters.has(parsed.id)) {
    waiters.get(parsed.id)(parsed);
    waiters.delete(parsed.id);
  }
  if (parsed.type === "tool_execution_start") {
    toolCalls.push(parsed.toolName || parsed.name);
  }
  if (parsed.type === "tool_call" || parsed.event === "tool_execution_start") {
    toolCalls.push(parsed.toolName);
  }
  if (parsed.type === "agent_settled") settled = true;
  if (parsed.type === "tool_execution_end") {
    toolResults.push({
      toolName: parsed.toolName,
      isError: parsed.isError,
    });
  }
});

function send(id, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${id}`)), 90_000);
    waiters.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    child.stdin.write(`${JSON.stringify({ id, ...payload })}\n`);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

try {
  await sleep(8000);
  await send("prompt", {
    type: "prompt",
    message:
      "按我之前的偏好，用 EverOS 记忆工具查我是谁。只调用记忆工具，不要用 bash。用一句话回答。",
  });
  const deadline = Date.now() + 75_000;
  while (!settled && Date.now() < deadline) {
    await sleep(500);
  }
  console.log(
    JSON.stringify(
      {
        settled,
        toolCalls: toolCalls.filter(Boolean),
        toolResults,
        stderrTail: stderr.slice(-1500),
      },
      null,
      2,
    ),
  );
  if (!settled) process.exitCode = 2;
} catch (error) {
  console.error(String(error));
  console.error(stderr.slice(-2000));
  process.exitCode = 1;
} finally {
  child.kill();
}
