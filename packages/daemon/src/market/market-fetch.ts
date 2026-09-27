import { KiboError, type Kpkg, MARKET_FETCH_TIMEOUT_MS, type MarketIndex } from "@kibo/schema";
import {
  decodeKpkg,
  KPKG_MAX_RAW_BYTES,
  type VerifiedMarketPackage,
  verifyIndex,
  verifyMarketPackage,
} from "@kibo/trust";
import type { HttpGet } from "./http-get";

export const INDEX_MAX_BYTES = 8 * 1024 * 1024;
export const SIG_MAX_BYTES = 4096;

export type FetchedIndex = { bytes: Uint8Array; sig: string };

const limits = (maxBytes: number) => ({ timeoutMs: MARKET_FETCH_TIMEOUT_MS, maxBytes });

function parseUrl(raw: string, base?: string): URL {
  try {
    return new URL(raw, base);
  } catch {
    throw new KiboError("INVALID_INPUT", "invalid market url");
  }
}

export function sourceBase(raw: string): string {
  const url = parseUrl(raw);
  if (url.username !== "" || url.password !== "") {
    throw new KiboError("INVALID_INPUT", "a market source url cannot carry credentials");
  }
  return url.href.endsWith("/") ? url.href : `${url.href}/`;
}

export function packageHref(sourceUrl: string, entryUrl: string): string {
  const url = parseUrl(entryUrl, sourceUrl);
  if (url.origin !== new URL(sourceUrl).origin) {
    throw new KiboError("INVALID_INPUT", "a market package must be served by its source");
  }
  return url.href;
}

export async function fetchIndex(get: HttpGet, base: string): Promise<FetchedIndex> {
  const bytes = await get(new URL("index.json", base).href, limits(INDEX_MAX_BYTES));
  const sig = await get(new URL("index.json.sig", base).href, limits(SIG_MAX_BYTES));
  return { bytes, sig: new TextDecoder().decode(sig).trim() };
}

export async function downloadKpkg(get: HttpGet, sourceUrl: string, entryUrl: string): Promise<Kpkg> {
  return decodeKpkg(await get(packageHref(sourceUrl, entryUrl), limits(KPKG_MAX_RAW_BYTES)));
}

export async function verifySourceIndex(
  row: { id: string; publicKey: string; lastSerial: number | null },
  fetched: FetchedIndex,
): Promise<MarketIndex> {
  const index = await verifyIndex({ ...fetched, expectedKey: row.publicKey, lastSerial: row.lastSerial });
  if (index.source.id !== row.id) {
    throw new KiboError("SIGNATURE_INVALID", `index of ${row.id} declares another source`);
  }
  return index;
}

export async function verifyForDetail(
  pkg: Kpkg,
  index: MarketIndex,
  pinned: string | null,
): Promise<{ verified: VerifiedMarketPackage; publisherChanged: boolean }> {
  try {
    return {
      verified: await verifyMarketPackage({ pkg, index, pinnedKey: pinned }),
      publisherChanged: false,
    };
  } catch (e) {
    if (!(e instanceof KiboError) || e.code !== "PUBLISHER_CHANGED") throw e;
    return { verified: await verifyMarketPackage({ pkg, index, pinnedKey: null }), publisherChanged: true };
  }
}
