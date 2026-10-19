import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_SETTINGS, loadSettings, parseSettings, saveSettings, settingsPath } from "../src/config.ts";

test("settings roundtrip never stores api keys", () => {
  process.env.PI_AGENT_DIR = mkdtempSync(join(tmpdir(), "pi-everos-"));
  saveSettings({
    ...DEFAULT_SETTINGS,
    userId: "tester",
    prompt: { ...DEFAULT_SETTINGS.prompt },
  });
  const raw = readFileSync(settingsPath(), "utf8");
  assert.doesNotMatch(raw, /apiKey|EVEROS_API_KEY|sk-/i);
  const loaded = loadSettings();
  assert.equal(loaded.userId, "tester");
  assert.equal(loaded.mode, "uvx");
});

test("invalid json and extra apiKey fall back or strip", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-everos-"));
  process.env.PI_AGENT_DIR = dir;
  mkdirSync(join(dir, "extension-settings"), { recursive: true });
  writeFileSync(settingsPath(), "{not json");
  const broken = loadSettings();
  assert.equal(broken.mode, "uvx");
  const parsed = parseSettings({
    apiKey: "sk-live-abcdefghijk",
    userId: "ok-user",
    prompt: { maxTokens: 9000, customText: "hello" },
  });
  assert.equal(parsed.userId, "ok-user");
  assert.equal(parsed.prompt.maxTokens, 2000);
  assert.equal(parsed.prompt.customText, "hello");
  assert.equal("apiKey" in parsed, false);
});
