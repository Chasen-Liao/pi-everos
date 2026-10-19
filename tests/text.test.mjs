import assert from "node:assert/strict";
import test from "node:test";
import { planBlockReason } from "../src/text.ts";

test("plan block copy follows PI_LANG", () => {
  const prev = process.env.PI_LANG;
  process.env.PI_LANG = "en";
  assert.match(planBlockReason("mcp__everos__add_memory"), /blocked/);
  process.env.PI_LANG = "zh-CN";
  assert.match(planBlockReason("mcp__everos__add_memory"), /拦截/);
  if (prev === undefined) delete process.env.PI_LANG;
  else process.env.PI_LANG = prev;
});
