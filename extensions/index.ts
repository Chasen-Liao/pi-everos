import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerEverosCommand } from "../src/commands.ts";
import { ensureSettingsFile, type EverosSettings } from "../src/config.ts";
import { mcpApiKeyEnv, resolveCredentials, resolveProcessCredentials } from "../src/credentials.ts";
import {
  GLOBAL_SERVER,
  everosToolNames,
  ownedServerNames,
  projectServerName,
  readFileEverosServer,
  resolveUvx,
  uvxConfig,
} from "../src/mcp.ts";
import { isMutatingMemoryTool, isPlanMode } from "../src/guard.ts";
import { buildEverosSection } from "../src/prompt.ts";
import { resolveProjectId } from "../src/scope.ts";
import { planBlockReason, t } from "../src/text.ts";

export default function (pi: ExtensionAPI) {
  let settings = ensureSettingsFile();
  const fileServer = readFileEverosServer();
  const uvx = resolveUvx();
  let creds = resolveProcessCredentials();
  let startupWarned = false;
  let errorWarned = false;
  let cwd = process.cwd();

  const projectId = () => resolveProjectId(settings.projectId, cwd);
  const servers = () => ownedServerNames(fileServer);

  const unregisterServers = () => {
    for (const name of servers()) {
      try {
        pi.unregisterMcpServer(name);
      } catch {
        // not registered
      }
    }
  };

  const registerServers = () => {
    if (!settings.enabled) return;
    if (!creds.present) return;
    const shared = {
      ...mcpApiKeyEnv(creds),
      EVEROS_USER_ID: settings.userId,
      EVEROS_APP_ID: settings.appId,
    };
    for (const name of servers()) {
      const id = name === GLOBAL_SERVER ? settings.globalProjectId : projectId();
      pi.registerMcpServer(name, uvxConfig({ ...shared, EVEROS_PROJECT_ID: id }));
    }
  };

  registerServers();

  registerEverosCommand({
    pi,
    settings: () => settings,
    setSettings: (next: EverosSettings) => {
      settings = next;
    },
    fileServer: () => fileServer,
    creds: () => creds,
    uvxCommand: () => uvx.command,
    uvxOnDisk: () => uvx.onDisk,
    registerServers,
    unregisterServers,
    projectId,
    setCwd: (next) => {
      cwd = next;
    },
  });

  pi.on("session_start", (_event, ctx) => {
    cwd = ctx.cwd;
    if (!creds.present) {
      creds = resolveCredentials();
      if (creds.present) registerServers();
    }
    if (startupWarned) return;
    startupWarned = true;
    if (!settings.enabled) return;
    if (!creds.present) {
      ctx.ui.notify(t("missingKey"), "warning");
    } else if (fileServer.overridesExtension) {
      ctx.ui.notify(t("override"), "warning");
    } else if (!uvx.onDisk) {
      ctx.ui.notify(t("uvMissing"), "warning");
    }
  });

  pi.on("tool_call", (event, ctx) => {
    const reason = isPlanMode(ctx.sessionManager.getBranch()) && isMutatingMemoryTool(event.toolName)
      ? planBlockReason(event.toolName)
      : undefined;
    if (reason) return { block: true, reason };
  });

  pi.on("tool_result", (event, ctx) => {
    if (errorWarned || !event.isError || !event.toolName.startsWith("mcp__everos")) return;
    errorWarned = true;
    ctx.ui.notify("EverOS: a memory tool failed. Main chat continues. /everos reconnect or /everos doctor.", "warning");
  });

  pi.on("session_shutdown", () => {
    unregisterServers();
  });

  pi.on("before_agent_start", (event, ctx) => {
    if (!settings.prompt.enabled) {
      delete event.systemPromptOptions.sections.everos;
      return;
    }
    const projectTools = everosToolNames(pi, projectServerName(fileServer));
    const globalTools = everosToolNames(pi, GLOBAL_SERVER);
    event.systemPromptOptions.sections.everos = buildEverosSection({
      available: settings.enabled && creds.present,
      projectId: projectId(),
      globalProjectId: settings.globalProjectId,
      projectTools,
      globalTools,
      maxTokens: settings.prompt.maxTokens,
      overrideWarning:
        fileServer.overridesExtension && projectTools.length === 0
          ? "Disable or rename the mcp.json `everos` entry, then /reload."
          : undefined,
    });
  });
}
