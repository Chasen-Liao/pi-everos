import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("auto project id sanitizes cwd basename", async () => {
  const { autoProjectId, isValidScopeId } = await import("../src/scope.ts");
  assert.equal(autoProjectId("D:/MyProjects/pi-everos"), "pi-everos");
  assert.equal(autoProjectId("C:\\\\Work\\\\Foo Bar"), "foo-bar");
  assert.equal(isValidScopeId("global"), true);
  assert.equal(isValidScopeId("bad id"), false);
});

test("prompt distinguishes project and global tools", () => {
  const src = readFileSync(new URL("../src/prompt.ts", import.meta.url), "utf8");
  assert.match(src, /Project scope/);
  assert.match(src, /Global scope/);
  assert.match(src, /searching project first, then global/);
  assert.match(src, /confirmed with them/);
});
