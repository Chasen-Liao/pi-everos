import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("forget_session prompt requires confirmation", () => {
  const src = readFileSync(new URL("../src/prompt.ts", import.meta.url), "utf8");
  assert.match(src, /confirmed with them/);
});

test("factory does not spawn processes", () => {
  const index = readFileSync(new URL("../extensions/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(index, /spawnSync|spawn\(/);
  assert.match(index, /resolveProcessCredentials/);
});
