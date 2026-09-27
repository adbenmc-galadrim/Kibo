import { type MarketComponentStatus, SECRET_MARKET_PUBLISHER } from "@kibo/schema";
import { keyFingerprint } from "@kibo/trust";
import type { SecretStore } from "../integrations/types";
import type { MarketService, RegistryPort } from "./market-service";
import { loadPublisherKeys } from "./publisher-keys";

export function marketStatuses(
  market: Pick<MarketService, "listSources" | "search">,
  installed: RegistryPort["installed"],
): MarketComponentStatus[] {
  const names = new Map(market.listSources().map((s) => [s.id, s.name]));
  return installed().flatMap(({ id, version, v }) => {
    if (!v.source) return [];
    const sourceId = v.source.sourceId;
    const hit = market.search({ query: id, sourceId }).find((h) => h.id === id);
    return [
      {
        id,
        version,
        sourceId,
        sourceName: names.get(sourceId) ?? sourceId,
        updateAvailable: hit?.updateAvailable ?? null,
      },
    ];
  });
}

export async function marketPublisherInfo(
  secrets: SecretStore,
): Promise<{ name: string; fingerprint: string } | null> {
  if (!(await secrets.has(SECRET_MARKET_PUBLISHER))) return null;
  const keys = await loadPublisherKeys(secrets);
  return { name: keys.name, fingerprint: await keyFingerprint(keys.publicKey) };
}
