const WRITE_SUFFIXES = ["add_memory", "forget_session", "record_trajectory"];

export function isMutatingMemoryTool(toolName: string): boolean {
  return WRITE_SUFFIXES.some((suffix) => toolName.endsWith(`__${suffix}`));
}

export function isPlanMode(entries: ReadonlyArray<{ type?: string; customType?: string; data?: unknown }>): boolean {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry?.customType !== "plan-mode") continue;
    const data = entry.data as { enabled?: boolean } | undefined;
    return data?.enabled === true;
  }
  return false;
}

export function planModeBlock(toolName: string, entries: ReadonlyArray<{ customType?: string; data?: unknown }>): string | undefined {
  if (!isMutatingMemoryTool(toolName) || !isPlanMode(entries)) return undefined;
  return `Plan mode: blocked ${toolName}. Memory writes are disabled until /plan is turned off.`;
}
