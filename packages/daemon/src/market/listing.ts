import { KiboError, type MarketIndex } from "@kibo/schema";

type Ref = { sourceId: string; id: string; version: string };

export function assertListedIn(index: MarketIndex, ref: Ref, hash: string, publisherKey: string): void {
  const label = `${ref.id}@${ref.version}`;
  const revoked = index.revoked.find((r) => r.hash === hash);
  if (revoked) throw new KiboError("REVOKED", `${label} is revoked: ${revoked.reason}`);
  const entry = index.packages
    .find((p) => p.id === ref.id)
    ?.versions.find((v) => v.version === ref.version && v.hash === hash);
  if (!entry) throw new KiboError("NOT_FOUND", `${label} is no longer in ${ref.sourceId}`);
  if (entry.publisherKey !== publisherKey) {
    throw new KiboError("SIGNATURE_INVALID", `${label} is now listed under another publisher`);
  }
}
