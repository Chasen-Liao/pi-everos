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

function openClient(projectId) {
  const child = spawn(resolveUvx(), ["everos-mcp"], {
    env: {
      ...process.env,
      EVEROS_USER_ID: "pi-everos-m3",
      EVEROS_APP_ID: "pi",
      EVEROS_PROJECT_ID: projectId,
    },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "";
  const pending = new Map();
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
  let nextId = 1;
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => reject(new Error(`timeout ${method} ${projectId}`)), 45_000);
      pending.set(id, (message) => {
        clearTimeout(timer);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      });
      send(child, { jsonrpc: "2.0", id, method, params });
    });
  return {
    child,
    async init() {
      await request("initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "pi-everos-m3", version: "0.0.0" },
      });
      send(child, { jsonrpc: "2.0", method: "notifications/initialized" });
    },
    call(name, args) {
      return request("tools/call", { name, arguments: args });
    },
    close() {
      child.kill();
    },
  };
}

function textOf(result) {
  const content = result?.content ?? [];
  return content.map((block) => block.text || "").join("\n");
}

async function main() {
  if (!process.env.EVEROS_API_KEY) {
    console.error("EVEROS_API_KEY missing");
    process.exit(2);
  }
  const stamp = Date.now().toString(36);
  const tokenA = `M3ISO_A_${stamp}`;
  const tokenB = `M3ISO_B_${stamp}`;
  const tokenG = `M3ISO_G_${stamp}`;
  const projectA = `m3-iso-a`;
  const projectB = `m3-iso-b`;
  const globalId = `m3-iso-global`;

  const a = openClient(projectA);
  const b = openClient(projectB);
  const g = openClient(globalId);
  try {
    await Promise.all([a.init(), b.init(), g.init()]);
    await a.call("add_memory", { user_message: `Remember isolation marker ${tokenA} for project A only.`, wait: true });
    await b.call("add_memory", { user_message: `Remember isolation marker ${tokenB} for project B only.`, wait: true });
    await g.call("add_memory", { user_message: `Remember isolation marker ${tokenG} as a global preference.`, wait: true });

    const aHasA = textOf(await a.call("search_memory", { query: tokenA, top_k: 3, include_profile: false }));
    const bHasA = textOf(await b.call("search_memory", { query: tokenA, top_k: 3, include_profile: false }));
    const aHasB = textOf(await a.call("search_memory", { query: tokenB, top_k: 3, include_profile: false }));
    const gHasG = textOf(await g.call("search_memory", { query: tokenG, top_k: 3, include_profile: false }));
    const aHasG = textOf(await a.call("search_memory", { query: tokenG, top_k: 3, include_profile: false }));

    const report = {
      tokenAFoundInA: aHasA.includes(tokenA),
      tokenAFoundInB: bHasA.includes(tokenA),
      tokenBFoundInA: aHasB.includes(tokenB),
      tokenGFoundInGlobal: gHasG.includes(tokenG),
      tokenGFoundInA: aHasG.includes(tokenG),
    };
    const isolated = report.tokenAFoundInA && !report.tokenAFoundInB && !report.tokenBFoundInA;
    const globalOk = report.tokenGFoundInGlobal;
    console.log(JSON.stringify({ ...report, isolated, globalOk }, null, 2));
    if (!isolated || !globalOk) process.exitCode = 1;
  } finally {
    a.close();
    b.close();
    g.close();
  }
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
