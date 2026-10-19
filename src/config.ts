import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { agentDir } from "./credentials.ts";
import { isValidScopeId } from "./scope.ts";

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
    customText?: string;
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
  if (!existsSync(path)) return cloneDefault();
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    return parseSettings(raw);
  } catch {
    return cloneDefault();
  }
}

export function saveSettings(settings: EverosSettings): void {
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });
  ensureSchemaCopy();
  const prompt: EverosSettings["prompt"] = {
    enabled: settings.prompt.enabled,
    maxTokens: settings.prompt.maxTokens,
  };
  if (settings.prompt.customText?.trim()) prompt.customText = settings.prompt.customText.trim();
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        $schema: "./schemas/everos.schema.json",
        enabled: settings.enabled,
        mode: "uvx",
        userId: settings.userId,
        appId: settings.appId,
        projectId: settings.projectId,
        globalProjectId: settings.globalProjectId,
        prompt,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export function ensureSettingsFile(): EverosSettings {
  const settings = loadSettings();
  if (!existsSync(settingsPath())) saveSettings(settings);
  else ensureSchemaCopy();
  return settings;
}

export function parseSettings(raw: Record<string, unknown>): EverosSettings {
  const promptRaw = isRecord(raw.prompt) ? raw.prompt : {};
  const customText = typeof promptRaw.customText === "string" ? promptRaw.customText.trim() : undefined;
  return {
    enabled: raw.enabled !== false,
    mode: "uvx",
    userId: scopeOr(raw.userId, DEFAULT_SETTINGS.userId),
    appId: scopeOr(raw.appId, DEFAULT_SETTINGS.appId),
    projectId: projectOr(raw.projectId, DEFAULT_SETTINGS.projectId),
    globalProjectId: scopeOr(raw.globalProjectId, DEFAULT_SETTINGS.globalProjectId),
    prompt: {
      enabled: promptRaw.enabled !== false,
      maxTokens: clampTokens(promptRaw.maxTokens),
      ...(customText ? { customText } : {}),
    },
  };
}

function scopeOr(value: unknown, fallback: string): string {
  return typeof value === "string" && isValidScopeId(value) ? value : fallback;
}

function projectOr(value: unknown, fallback: string): string {
  if (value === "auto") return "auto";
  return scopeOr(value, fallback);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneDefault(): EverosSettings {
  return { ...DEFAULT_SETTINGS, prompt: { ...DEFAULT_SETTINGS.prompt } };
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
