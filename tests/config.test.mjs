import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("settings roundtrip never stores api keys", async () => {
  process.env.PI_AGENT_DIR = mkdtempSync(join(tmpdir(), "pi-everos-"));
  const { DEFAULT_SETTINGS, saveSettings, loadSettings, settingsPath } = await import("../src/config.ts");
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
