import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { EverosSettings } from "./config.ts";
import { saveSettings } from "./config.ts";
import type { FileServerInfo } from "./mcp.ts";
import {
  GLOBAL_SERVER,
  PROJECT_SERVER,
  SPIKE_SERVER,
  everosToolNames,
  ownedServerNames,
  projectServerName,
  uvInstallHint,
  waitForTools,
} from "./mcp.ts";
import { buildDoctorReport } from "./report.ts";
import type { ResolvedCredentials } from "./credentials.ts";
import { isValidScopeId } from "./scope.ts";

export interface CommandDeps {
  pi: ExtensionAPI;
  settings: () => EverosSettings;
  setSettings: (next: EverosSettings) => void;
  fileServer: () => FileServerInfo;
  creds: () => ResolvedCredentials;
  uvxCommand: () => string;
  uvxOnDisk: () => boolean;
  registerServers: () => void;
  unregisterServers: () => void;
  projectId: () => string;
  setCwd: (cwd: string) => void;
}

const SUBS = ["status", "login", "logout", "scope", "reconnect", "doctor"] as const;

export function registerEverosCommand(deps: CommandDeps): void {
  deps.pi.registerCommand("everos", {
    description: "EverOS memory status and diagnostics",
    getArgumentCompletions: (prefix) => {
      const trimmed = prefix.trim();
      const [head, tail] = trimmed.split(/\s+/);
      if (!head || SUBS.some((name) => name.startsWith(trimmed))) {
        return SUBS.filter((name) => name.startsWith(trimmed)).map((value) => ({ value, label: value }));
      }
      if (head === "scope") {
        const options = ["auto", "project", "global"];
        const needle = tail ?? "";
        return options.filter((name) => name.startsWith(needle)).map((value) => ({ value: `scope ${value}`, label: value }));
      }
      return [];
    },
    handler: async (args, ctx) => {
      deps.setCwd(ctx.cwd);
      const tokens = args.trim().split(/\s+/).filter(Boolean);
      const sub = tokens[0] || "status";
      switch (sub) {
        case "login":
          return login(ctx);
        case "logout":
          return logout(deps, ctx);
        case "reconnect":
          return reconnect(deps, ctx);
        case "scope":
          return scope(deps, ctx, tokens.slice(1));
        case "doctor":
          return status(deps, ctx, true);
        default:
          return status(deps, ctx, false);
      }
    },
  });
}

async function status(deps: CommandDeps, ctx: ExtensionCommandContext, doctor: boolean): Promise<void> {
  const settings = deps.settings();
  const fileServer = deps.fileServer();
  const creds = deps.creds();
  const servers = ownedServerNames(fileServer);
  const projectServer = projectServerName(fileServer);
  if (settings.enabled) await waitForTools(deps.pi, projectServer, 12_000);
  const counts = {
    [SPIKE_SERVER]: everosToolNames(deps.pi, SPIKE_SERVER).length,
    [PROJECT_SERVER]: everosToolNames(deps.pi, PROJECT_SERVER).length,
    [GLOBAL_SERVER]: everosToolNames(deps.pi, GLOBAL_SERVER).length,
  };
  const notes: string[] = [];
  if (fileServer.overridesExtension) {
    notes.push("doctor: rename or disable ~/.pi/agent/mcp.json everos so the extension can own that name. This plugin will not edit that file.");
  }
  if (!deps.uvxOnDisk()) notes.push(uvInstallHint());
  if (!creds.present) notes.push("doctor: set EVEROS_API_KEY in the user environment, then /everos login or restart Pi.");
  if (settings.enabled && counts[projectServer] === 0 && counts[GLOBAL_SERVER] === 0) {
    notes.push("doctor: no extension-owned EverOS tools yet. Wait for MCP connect, or check uvx/key.");
  }
  if (!settings.enabled) notes.push("doctor: plugin disabled in everos.json. /everos login to enable.");
  const report = buildDoctorReport({
    enabled: settings.enabled,
    uvx: deps.uvxCommand(),
    uvxOnDisk: deps.uvxOnDisk(),
    keySource: creds.present ? creds.source : "missing",
    fileEveros: fileServer.present ? (fileServer.enabled ? "enabled" : "disabled") : "absent",
    fileCommand: fileServer.command,
    override: fileServer.overridesExtension,
    userId: settings.userId,
    appId: settings.appId,
    projectId: deps.projectId(),
    globalProjectId: settings.globalProjectId,
    owned: servers,
    toolCounts: counts,
    promptEnabled: settings.prompt.enabled,
    notes: doctor ? notes : [],
  });
  ctx.ui.notify(report, fileServer.overridesExtension || !creds.present || !settings.enabled ? "warning" : "info");
}

async function scope(deps: CommandDeps, ctx: ExtensionCommandContext, args: string[]): Promise<void> {
  const settings = deps.settings();
  const [action, value] = args;
  if (!action) {
    ctx.ui.notify(scopeLines(deps, settings).join("\n"), "info");
    return;
  }
  if (action === "auto") {
    applyScope(deps, { ...settings, projectId: "auto" });
    ctx.ui.notify(`projectId=auto → ${deps.projectId()}\nReconnected project and global MCP servers.`, "info");
    return;
  }
  if (action === "project") {
    if (!value || !isValidScopeId(value)) {
      ctx.ui.notify("Usage: /everos scope project <id>  (letters, digits, . _ @ + -)", "warning");
      return;
    }
    applyScope(deps, { ...settings, projectId: value });
    ctx.ui.notify(`projectId=${deps.projectId()}\nReconnected project and global MCP servers.`, "info");
    return;
  }
  if (action === "global") {
    if (!value || !isValidScopeId(value) || value === "auto") {
      ctx.ui.notify("Usage: /everos scope global <id>  (letters, digits, . _ @ + -)", "warning");
      return;
    }
    applyScope(deps, { ...settings, globalProjectId: value });
    ctx.ui.notify(`globalProjectId=${value}\nReconnected project and global MCP servers.`, "info");
    return;
  }
  ctx.ui.notify("Usage: /everos scope [auto|project <id>|global <id>]", "warning");
}

function applyScope(deps: CommandDeps, next: EverosSettings): void {
  deps.setSettings(next);
  saveSettings(next);
  deps.unregisterServers();
  deps.registerServers();
}

function scopeLines(deps: CommandDeps, settings: EverosSettings): string[] {
  return [
    `userId=${settings.userId}`,
    `appId=${settings.appId}`,
    `projectId=${deps.projectId()} (setting=${settings.projectId})`,
    `globalProjectId=${settings.globalProjectId}`,
    "Search project tools for workspace facts; search global tools for user-wide preferences.",
    "Change: /everos scope auto | /everos scope project <id> | /everos scope global <id>",
  ];
}

async function login(ctx: ExtensionCommandContext): Promise<void> {
  ctx.ui.notify(
    [
      "EverOS login does not store the API key in everos.json.",
      "1. Create a key in the EverOS Console.",
      "2. Set user environment variable EVEROS_API_KEY.",
      "3. Restart Pi or run /everos reconnect.",
      "Windows: setx EVEROS_API_KEY your_key",
    ].join("\n"),
    "info",
  );
}

async function logout(deps: CommandDeps, ctx: ExtensionCommandContext): Promise<void> {
  const next = { ...deps.settings(), enabled: false };
  deps.setSettings(next);
  saveSettings(next);
  deps.unregisterServers();
  ctx.ui.notify("EverOS disconnected for this plugin. User EVEROS_API_KEY was not deleted.", "info");
}

async function reconnect(deps: CommandDeps, ctx: ExtensionCommandContext): Promise<void> {
  const next = { ...deps.settings(), enabled: true };
  deps.setSettings(next);
  saveSettings(next);
  deps.unregisterServers();
  deps.registerServers();
  ctx.ui.notify("EverOS reconnect requested. Run /everos status after tools appear.", "info");
}
