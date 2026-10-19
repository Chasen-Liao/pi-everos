import assert from "node:assert/strict";
import test from "node:test";
import { buildDoctorReport } from "../src/report.ts";

test("doctor report is pasteable and has no secrets", () => {
  const report = buildDoctorReport({
    enabled: true,
    uvx: "C:\\\\uvx.exe",
    uvxOnDisk: true,
    keySource: "process-env",
    fileEveros: "enabled",
    fileCommand: "python.exe",
    override: true,
    userId: "chasen-demo",
    appId: "pi",
    projectId: "pi-everos",
    globalProjectId: "global",
    owned: ["everos-pi", "everos-global"],
    toolCounts: { "everos-pi": 7, everos: 0, "everos-global": 7 },
    promptEnabled: true,
    notes: ["doctor: EVEROS_API_KEY=sk-live-abcdefghijk should not leak"],
  });
  assert.match(report, /^----- pi-everos doctor -----$/m);
  assert.match(report, /^----- end -----$/m);
  assert.match(report, /override=mcp.json wins/);
  assert.doesNotMatch(report, /sk-live-abcdefghijk/);
  assert.doesNotMatch(report, /EVEROS_API_KEY=sk/);
});
