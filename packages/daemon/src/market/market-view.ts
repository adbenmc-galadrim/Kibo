import {
  compareSemver,
  KiboError,
  type MarketHit,
  type MarketIndex,
  type MarketSourceInfo,
  type MarketVersionInfo,
  type RegistryVersion,
} from "@kibo/schema";
import { z } from "zod";
import type { MarketSourceRow } from "./market-db";

export type InstalledVersion = { id: string; title: string; version: string; v: RegistryVersion };
type IndexedPackage = MarketIndex["packages"][number];

const Announced = z.object({
  source: z.object({ id: z.string(), name: z.string(), publicKey: z.string() }),
});
const SourceId = z.string().min(1).max(64);

export const fold = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function announcedSource(bytes: Uint8Array, url: string): z.infer<typeof Announced>["source"] {
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `not a Kibo market index: ${url}: ${String(e)}`);
  }
  const announced = Announced.safeParse(json);
  if (!announced.success) throw new KiboError("INVALID_INPUT", `not a Kibo market index: ${url}`);
  return announced.data.source;
}

export function assertSourceId(id: string): void {
  if (!SourceId.safeParse(id).success) {
    throw new KiboError("INVALID_INPUT", `invalid market source id: ${JSON.stringify(id.slice(0, 80))}`);
  }
}

export function sourceInfo(r: MarketSourceRow): MarketSourceInfo {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    publicKey: r.publicKey,
    fingerprint: r.fingerprint,
    lastSerial: r.lastSerial,
    lastFetchedAt: r.lastFetchedAt,
    lastError: r.lastError,
    enabled: r.enabled,
  };
}

export function publisherOf(index: MarketIndex, key: string): MarketHit["publisher"] {
  const p = index.publishers.find((x) => x.publicKey === key);
  return { name: p?.name ?? "?", publicKey: key, verified: p?.verified ?? false };
}

export function versionInfos(entry: IndexedPackage, index: MarketIndex): MarketVersionInfo[] {
  const revoked = new Map(index.revoked.map((r) => [r.hash, r.reason]));
  return entry.versions.map((v) => ({
    version: v.version,
    hash: v.hash,
    size: v.size,
    permissions: v.permissions,
    publishedAt: v.publishedAt,
    revoked: revoked.get(v.hash) ?? null,
  }));
}

export function matches(entry: IndexedPackage, query: string): boolean {
  return query === "" || [entry.title, entry.description, entry.id].some((t) => fold(t).includes(query));
}

export function buildHit(
  row: MarketSourceRow,
  index: MarketIndex,
  entry: IndexedPackage,
  installed: InstalledVersion[],
): MarketHit | null {
  const revoked = new Set(index.revoked.map((r) => r.hash));
  const live = entry.versions
    .filter((v) => !revoked.has(v.hash))
    .sort((a, b) => compareSemver(a.version, b.version));
  const latest = live[live.length - 1];
  if (!latest) return null;
  const mine = installed
    .filter((i) => i.id === entry.id && i.v.source?.sourceId === row.id)
    .map((i) => i.version)
    .sort(compareSemver);
  const current = mine[mine.length - 1] ?? null;
  return {
    sourceId: row.id,
    sourceName: row.name,
    id: entry.id,
    title: entry.title,
    description: entry.description,
    kind: entry.kind,
    latest: latest.version,
    publisher: publisherOf(index, latest.publisherKey),
    installed: current,
    updateAvailable: current !== null && compareSemver(latest.version, current) > 0 ? latest.version : null,
  };
}
