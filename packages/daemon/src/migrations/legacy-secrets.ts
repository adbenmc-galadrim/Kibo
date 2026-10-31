import type { SecretStore } from "../integrations/types";
import type { RunStore } from "../runs/run-store";

export const ORPHAN_SECRET_NAMES = ["remote:tls", "sync:device", "market:publisher"] as const;
export type OrphanSecretName = (typeof ORPHAN_SECRET_NAMES)[number];
export const SECRETS_PRUNED_MARKER = "secrets_pruned_at";

export const isOrphanSecretName = (name: string): name is OrphanSecretName =>
  (ORPHAN_SECRET_NAMES as readonly string[]).includes(name);

export function markSecretsPruned(runs: Pick<RunStore, "setMarker">, now: () => number): void {
  runs.setMarker(SECRETS_PRUNED_MARKER, new Date(now()).toISOString());
}

export async function pruneOrphanSecrets(
  secrets: Pick<SecretStore, "delete">,
  runs: Pick<RunStore, "marker" | "setMarker">,
  now: () => number,
): Promise<string[]> {
  if (runs.marker(SECRETS_PRUNED_MARKER) !== null) return [];
  for (const name of ORPHAN_SECRET_NAMES) await secrets.delete(name);
  markSecretsPruned(runs, now);
  return [...ORPHAN_SECRET_NAMES];
}
