import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { agentDir } from "./credentials.ts";

export interface EverosSettings {
  enabled: boolean;
  mode: "uvx";
  userId: string;
  appId: string;
  projectId: string;
  globalProjectId: string;
  prompt: {
    enabled: boolean;
    maxTokens: number;
  };
}

export const DEFAULT_SETTINGS: EverosSettings = {
  enabled: true,
  mode: "uvx",
  userId: process.env.EVEROS_USER_ID?.trim() || "default-user",
  appId: process.env.EVEROS_APP_ID?.trim() || "pi",
  projectId: "auto",
  globalProjectId: "global",
  prompt: {
    enabled: true,
    maxTokens: 200,
  },
};

export function settingsPath(): string {
  return join(agentDir(), "extension-settings", "everos.json");
}

export function schemaDestPath(): string {
  return join(agentDir(), "extension-settings", "schemas", "everos.schema.json");
}

export function loadSettings(): EverosSettings {
  const path = settingsPath();
  if (!existsSync(path)) return { ...DEFAULT_SETTINGS, prompt: { ...DEFAULT_SETTINGS.prompt } };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<EverosSettings> & {
      prompt?: Partial<EverosSettings["prompt"]>;
    };
    return {
      enabled: raw.enabled !== false,
      mode: "uvx",
      userId: typeof raw.userId === "string" && raw.userId.trim() ? raw.userId.trim() : DEFAULT_SETTINGS.userId,
      appId: typeof raw.appId === "string" && raw.appId.trim() ? raw.appId.trim() : DEFAULT_SETTINGS.appId,
      projectId:
        typeof raw.projectId === "string" && raw.projectId.trim() ? raw.projectId.trim() : DEFAULT_SETTINGS.projectId,
      globalProjectId:
        typeof raw.globalProjectId === "string" && raw.globalProjectId.trim()
          ? raw.globalProjectId.trim()
          : DEFAULT_SETTINGS.globalProjectId,
      prompt: {
        enabled: raw.prompt?.enabled !== false,
        maxTokens: clampTokens(raw.prompt?.maxTokens),
      },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, prompt: { ...DEFAULT_SETTINGS.prompt } };
  }
}

export function saveSettings(settings: EverosSettings): void {
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });
  ensureSchemaCopy();
  const body = {
    $schema: "./schemas/everos.schema.json",
    enabled: settings.enabled,
    mode: settings.mode,
    userId: settings.userId,
    appId: settings.appId,
    projectId: settings.projectId,
    globalProjectId: settings.globalProjectId,
    prompt: settings.prompt,
  };
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}

export function ensureSettingsFile(): EverosSettings {
  const settings = loadSettings();
  if (!existsSync(settingsPath())) saveSettings(settings);
  else ensureSchemaCopy();
  return settings;
}

function clampTokens(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_SETTINGS.prompt.maxTokens;
  return Math.min(2000, Math.max(0, Math.floor(value)));
}

function ensureSchemaCopy(): void {
  const dest = schemaDestPath();
  let src: string | undefined;
  try {
    src = join(dirname(fileURLToPath(import.meta.url)), "..", "schemas", "everos.schema.json");
  } catch {
    src = join(process.cwd(), "schemas", "everos.schema.json");
  }
  if (!src || !existsSync(src)) return;
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}
