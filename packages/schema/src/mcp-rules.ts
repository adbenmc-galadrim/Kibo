import type { ComponentManifest } from "./manifest";

export function secretHostsCovered(manifest: ComponentManifest): string[] {
  const netHosts = new Set(manifest.net.map((rule) => rule.split("/")[0]));
  return manifest.secrets.flatMap((s) => s.hosts.filter((h) => !netHosts.has(h)));
}
