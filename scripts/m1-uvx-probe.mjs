import { spawn, spawnSync } from "node:child_process";

function resolveUvx() {
  if (process.platform === "win32") {
    const result = spawnSync("where", ["uvx"], { encoding: "utf8", windowsHide: true });
    const command = result.stdout?.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (command) return command;
  }
  return "uvx";
}

function send(child, message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

async function main() {
  if (!process.env.EVEROS_API_KEY) {
    console.error("EVEROS_API_KEY missing");
    process.exit(2);
  }

  const child = spawn(resolveUvx(), ["everos-mcp"], {
    env: {
      ...process.env,
      EVEROS_USER_ID: process.env.EVEROS_USER_ID || "chasen-demo",
      EVEROS_APP_ID: process.env.EVEROS_APP_ID || "pi",
      EVEROS_PROJECT_ID: process.env.EVEROS_PROJECT_ID || "pi-everos",
    },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  let stdout = "";
  let stderr = "";
  const pending = new Map();

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString("utf8");
    const lines = stdout.split(/\r?\n/);
    stdout = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      if (message.id !== undefined && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    }
  });

  const request = (id, method, params) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout: ${method}\n${stderr.slice(-1500)}`)), 45_000);
      pending.set(id, (message) => {
        clearTimeout(timer);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      });
      send(child, { jsonrpc: "2.0", id, method, params });
    });

  try {
    const init = await request(1, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "pi-everos-m1", version: "0.0.0" },
    });
    send(child, { jsonrpc: "2.0", method: "notifications/initialized" });
    const listed = await request(2, "tools/list", {});
    const names = (listed.tools || []).map((tool) => tool.name).sort();
    const search = await request(3, "tools/call", {
      name: "search_memory",
      arguments: { query: "user preferences", top_k: 1, include_profile: false },
    });
    console.log(
      JSON.stringify(
        {
          server: init.serverInfo,
          tools: names,
          toolCount: names.length,
          searchIsError: Boolean(search.isError),
          searchPreview: JSON.stringify(search).slice(0, 500),
          stderr: stderr.trim(),
        },
        null,
        2,
      ),
    );
  } finally {
    child.kill();
  }
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
