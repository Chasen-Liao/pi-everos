import assert from "node:assert/strict";
import test from "node:test";
import { isMutatingMemoryTool, isPlanMode, planModeBlock } from "../src/guard.ts";

test("only write memory tools are mutating", () => {
  assert.equal(isMutatingMemoryTool("mcp__everos_pi__add_memory"), true);
  assert.equal(isMutatingMemoryTool("mcp__everos_global__forget_session"), true);
  assert.equal(isMutatingMemoryTool("mcp__everos__record_trajectory"), true);
  assert.equal(isMutatingMemoryTool("mcp__everos_pi__search_memory"), false);
  assert.equal(isMutatingMemoryTool("mcp__everos_pi__get_profile"), false);
  assert.equal(isMutatingMemoryTool("bash"), false);
});

test("plan mode uses the latest plan-mode entry", () => {
  assert.equal(isPlanMode([]), false);
  assert.equal(isPlanMode([{ customType: "plan-mode", data: { enabled: true } }]), true);
  assert.equal(
    isPlanMode([
      { customType: "plan-mode", data: { enabled: true } },
      { customType: "plan-mode", data: { enabled: false } },
    ]),
    false,
  );
});

test("plan mode blocks writes and allows search", () => {
  const on = [{ customType: "plan-mode", data: { enabled: true } }];
  assert.match(planModeBlock("mcp__everos__add_memory", on), /blocked/);
  assert.equal(planModeBlock("mcp__everos__search_memory", on), undefined);
  assert.equal(planModeBlock("mcp__everos__add_memory", []), undefined);
});
