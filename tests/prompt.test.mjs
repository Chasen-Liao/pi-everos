import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildEverosSection } from "../src/prompt.ts";

const seven = {
  projectTools: [
    "mcp__everos__search_memory",
    "mcp__everos__add_memory",
    "mcp__everos__get_profile",
    "mcp__everos__list_memories",
    "mcp__everos__forget_session",
    "mcp__everos__record_trajectory",
    "mcp__everos__recall_agent_experience",
  ],
  globalTools: [
    "mcp__everos_global__search_memory",
    "mcp__everos_global__add_memory",
    "mcp__everos_global__get_profile",
    "mcp__everos_global__list_memories",
    "mcp__everos_global__forget_session",
    "mcp__everos_global__record_trajectory",
    "mcp__everos_global__recall_agent_experience",
  ],
};

test("default 200-token prompt keeps forget confirm and refuse-save", () => {
  const text = buildEverosSection({
    available: true,
    projectId: "pi-everos",
    globalProjectId: "global",
    maxTokens: 200,
    ...seven,
  });
  assert.match(text, /confirmed with them/);
  assert.match(text, /not to remember/);
  assert.ok(text.length <= 800);
});

test("factory does not spawn processes", () => {
  const index = readFileSync(new URL("../extensions/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(index, /spawnSync|spawn\(/);
  assert.match(index, /resolveProcessCredentials/);
});
