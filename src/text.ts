export type Locale = "en" | "zh";

export function locale(): Locale {
  const hint = process.env.PI_LANG || process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale;
  return /^zh\b/i.test(hint) ? "zh" : "en";
}

const COPY = {
  planBlock: {
    en: (tool: string) => `Plan mode: blocked ${tool}. Memory writes are disabled until /plan is turned off.`,
    zh: (tool: string) => `计划模式已拦截 ${tool}。关闭 /plan 后才能写入记忆。`,
  },
  missingKey: {
    en: "EverOS: EVEROS_API_KEY missing. Run /everos doctor.",
    zh: "EverOS：缺少 EVEROS_API_KEY。请运行 /everos doctor。",
  },
  override: {
    en: "EverOS: mcp.json already has `everos`, so it overrides that name. The plugin uses a fallback server. /everos doctor for details.",
    zh: "EverOS：mcp.json 已占用 everos 名称，插件改用后备服务器。详见 /everos doctor。",
  },
  uvMissing: {
    en: "EverOS: uvx binary not found in ~/.local/bin. If connect fails, install uv. /everos doctor.",
    zh: "EverOS：未在 ~/.local/bin 找到 uvx。若连接失败请安装 uv。详见 /everos doctor。",
  },
} as const;

export function t(key: "missingKey" | "override" | "uvMissing"): string {
  return COPY[key][locale()];
}

export function planBlockReason(toolName: string): string {
  return COPY.planBlock[locale()](toolName);
}
