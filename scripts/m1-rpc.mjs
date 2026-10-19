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
  [
    "--mode",
    "rpc",
    "--no-session",
    "--no-skills",
    "--approve",
    "-e",
    "./extensions/index.ts",
  ],
  {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env: process.env,
    shell: pi.shell,
  },
);

const events = [];
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
    events.push({ type: "nonjson", line: line.slice(0, 200) });
    return;
  }
  events.push(parsed);
  if (parsed.id && waiters.has(parsed.id)) {
    waiters.get(parsed.id)(parsed);
    waiters.delete(parsed.id);
  }
});

function send(id, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${id}`)), 20_000);
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

function summarize(record) {
  if (record.method === "notify") {
    return { notify: record.notifyType, message: record.message };
  }
  if (record.type === "response") {
    return { command: record.command, success: record.success, data: record.data };
  }
  return { type: record.type, method: record.method };
}

try {
  await sleep(8000);
  const commands = await send("cmd", { type: "get_commands" });
  const everos = (commands.data?.commands || []).filter((c) => c.name.includes("everos"));
  const status = await send("status", { type: "prompt", message: "/everos status" });
  await sleep(1500);
  const doctor = await send("doctor", { type: "prompt", message: "/everos doctor" });
  await sleep(1500);
  const notifies = events.filter((e) => e.method === "notify" || e.type === "extension_ui_request");
  console.log(
    JSON.stringify(
      {
        everosCommands: everos,
        statusDisposition: status.data,
        doctorDisposition: doctor.data,
        ui: notifies.map(summarize),
        stderrTail: stderr.slice(-2500),
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(String(error));
  console.error(stderr.slice(-2500));
  process.exitCode = 1;
} finally {
  child.kill();
}
