import type { ComponentManifest } from "./manifest";

export const CONFIG_SERVER_RULE = "{config.server}";

export function mcpCovered(
  rules: readonly string[],
  server: string,
  tool: string | null,
  config: Record<string, unknown> | null,
): boolean {
  const resolved: string[] = [];
  for (const rule of rules) {
    if (rule !== CONFIG_SERVER_RULE) resolved.push(rule);
    else if (config !== null && typeof config.server === "string") resolved.push(config.server);
  }
  return resolved.some((r) => r === server || (tool !== null && r === `${server}/${tool}`));
}

export function secretHostsCovered(manifest: ComponentManifest): string[] {
  const netHosts = new Set(manifest.net.map((rule) => rule.split("/")[0]));
  return manifest.secrets.flatMap((s) => s.hosts.filter((h) => !netHosts.has(h)));
}
