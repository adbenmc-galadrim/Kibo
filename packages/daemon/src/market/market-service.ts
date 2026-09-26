import {
  type ComponentKind,
  KiboError,
  type Kpkg,
  MARKET_FETCH_TIMEOUT_MS,
  type MarketHit,
  type MarketIndex,
  type MarketPackageDetail,
  type MarketProbe,
  type MarketSourceInfo,
  type RegistryVersion,
} from "@kibo/schema";
import {
  decodeKpkg,
  KPKG_MAX_RAW_BYTES,
  keyFingerprint,
  type MarketPublisher,
  parsePublicKey,
  type SourceFile,
  type VerifiedMarketPackage,
  verifyIndex,
  verifyMarketPackage,
} from "@kibo/trust";
import type { Notice } from "../agents/notifier";
import type { HttpGet } from "./http-get";
import type { MarketDb, MarketSourceRow } from "./market-db";
import {
  announcedSource,
  assertSourceId,
  buildHit,
  errorMessage,
  fold,
  type InstalledVersion,
  matches,
  sourceInfo,
  versionInfos,
} from "./market-view";

export type RegistryPort = {
  get(id: string, version: string): RegistryVersion | null;
  put(id: string, title: string, v: RegistryVersion): void;
  installed(): InstalledVersion[];
  revoke(id: string, version: string, reason: string, at: number): void;
};

export type MarketServiceDeps = {
  db: MarketDb;
  get: HttpGet;
  registry: RegistryPort;
  now: () => number;
  notify(notice: Notice): void;
  log(message: string, error: unknown): void;
  emit(): void;
};

export type PackageRef = { sourceId: string; id: string; version: string };
export type FetchedPackage = {
  pkg: Kpkg;
  files: SourceFile[];
  newPublisher: boolean;
  publisher: MarketPublisher;
};

export const INDEX_MAX_BYTES = 8 * 1024 * 1024;
export const SIG_MAX_BYTES = 4096;

const withSlash = (url: string) => (url.endsWith("/") ? url : `${url}/`);

export class MarketService {
  private readonly indexes = new Map<string, MarketIndex>();

  constructor(private readonly deps: MarketServiceDeps) {}

  async load(): Promise<void> {
    for (const row of this.deps.db.sources()) {
      const cached = this.deps.db.cachedIndex(row.id);
      if (!cached) continue;
      try {
        this.indexes.set(
          row.id,
          await verifyIndex({ ...cached, expectedKey: row.publicKey, lastSerial: row.lastSerial }),
        );
      } catch (e) {
        this.deps.db.setError(row.id, errorMessage(e));
        this.deps.log(`market: cached index of ${row.id} rejected`, e);
      }
    }
  }

  listSources(): MarketSourceInfo[] {
    return this.deps.db.sources().map(sourceInfo);
  }

  async probe(url: string): Promise<MarketProbe> {
    const fetched = await this.fetchIndex(url);
    const announced = announcedSource(fetched.bytes, url);
    parsePublicKey(announced.publicKey);
    const index = await verifyIndex({ ...fetched, expectedKey: announced.publicKey, lastSerial: null });
    assertSourceId(index.source.id);
    return {
      sourceId: index.source.id,
      name: index.source.name,
      publicKey: index.source.publicKey,
      fingerprint: await keyFingerprint(index.source.publicKey),
      serial: index.serial,
      packages: index.packages.length,
    };
  }

  async addSource(input: { url: string; publicKey: string }): Promise<MarketSourceInfo> {
    const fingerprint = await keyFingerprint(input.publicKey);
    const fetched = await this.fetchIndex(input.url);
    const index = await verifyIndex({ ...fetched, expectedKey: input.publicKey, lastSerial: null });
    const id = index.source.id;
    assertSourceId(id);
    if (this.deps.db.source(id)) throw new KiboError("INVALID_INPUT", `market source ${id} already exists`);
    this.deps.db.addSource({
      id,
      url: withSlash(input.url),
      name: index.source.name,
      publicKey: input.publicKey,
      fingerprint,
      lastSerial: null,
      lastFetchedAt: null,
      enabled: true,
      lastError: null,
    });
    this.deps.db.setFetched(id, { serial: index.serial, ...fetched, at: this.deps.now() });
    this.indexes.set(id, index);
    const row = this.deps.db.source(id);
    if (!row) throw new KiboError("INTERNAL", `market source ${id} was not stored`);
    this.deps.emit();
    return sourceInfo(row);
  }

  removeSource(id: string): void {
    this.deps.db.removeSource(id);
    this.indexes.delete(id);
    this.deps.emit();
  }

  async refresh(sourceId?: string): Promise<void> {
    const rows = this.deps.db
      .sources()
      .filter((r) => r.enabled && (sourceId === undefined || r.id === sourceId));
    if (sourceId !== undefined && rows.length === 0)
      throw new KiboError("NOT_FOUND", `market source ${sourceId}`);
    for (const row of rows) {
      try {
        await this.refreshOne(row);
      } catch (e) {
        this.deps.db.setError(row.id, errorMessage(e));
        this.deps.log(`market: refresh of ${row.id} failed`, e);
        if (sourceId !== undefined) throw e;
      } finally {
        this.deps.emit();
      }
    }
  }

  search(input: { query: string; sourceId?: string; kind?: ComponentKind }): MarketHit[] {
    const query = fold(input.query.trim());
    const installed = this.deps.registry.installed();
    const hits: MarketHit[] = [];
    for (const row of this.deps.db.sources()) {
      if (!row.enabled || (input.sourceId !== undefined && row.id !== input.sourceId)) continue;
      const index = this.indexes.get(row.id);
      for (const entry of index?.packages ?? []) {
        if (!index || (input.kind !== undefined && entry.kind !== input.kind) || !matches(entry, query))
          continue;
        const hit = buildHit(row, index, entry, installed);
        if (hit) hits.push(hit);
      }
    }
    return hits.sort((a, b) => a.title.localeCompare(b.title, "fr"));
  }

  async getPackage(input: PackageRef): Promise<MarketPackageDetail> {
    const { row, index } = this.source(input.sourceId);
    const pkg = await this.download(row, index, input.id, input.version);
    const pinned = this.deps.db.pin(input.sourceId, input.id);
    const { verified, publisherChanged } = await this.verifyForDetail(pkg, index, pinned);
    const entry = index.packages.find((p) => p.id === input.id);
    const version = entry?.versions.find((v) => v.version === input.version);
    const hit = entry ? buildHit(row, index, entry, this.deps.registry.installed()) : null;
    if (!hit || !entry || !version) throw new KiboError("NOT_FOUND", `${input.id}@${input.version}`);
    const decoder = new TextDecoder();
    return {
      ...hit,
      publisher: { ...verified.publisher, publicKey: pkg.publisher.publicKey },
      version: input.version,
      hash: version.hash,
      size: version.size,
      permissions: version.permissions,
      versions: versionInfos(entry, index),
      pinnedPublisher: pinned,
      newPublisher: publisherChanged ? false : verified.newPublisher,
      publisherChanged,
      files: verified.files.map((f) => ({ path: f.path, content: decoder.decode(f.bytes) })),
    };
  }

  async fetchVerified(input: PackageRef): Promise<FetchedPackage> {
    const { row, index } = this.source(input.sourceId);
    const pkg = await this.download(row, index, input.id, input.version);
    const verified = await verifyMarketPackage({
      pkg,
      index,
      pinnedKey: this.deps.db.pin(input.sourceId, input.id),
    });
    return { pkg, ...verified };
  }

  pinPublisher(sourceId: string, componentId: string, publisherKey: string): void {
    this.deps.db.setPin(sourceId, componentId, publisherKey, this.deps.now());
  }

  unpinPublisher(input: { sourceId: string; componentId: string }): void {
    this.deps.db.unpin(input.sourceId, input.componentId);
  }

  findSourceFor(input: { id: string; version: string; hash: string | null }): { sourceId: string } | null {
    for (const row of this.deps.db.sources()) {
      const index = row.enabled ? this.indexes.get(row.id) : undefined;
      const version = index?.packages
        .find((p) => p.id === input.id)
        ?.versions.find((v) => v.version === input.version);
      if (!index || !version) continue;
      if (index.revoked.some((r) => r.hash === version.hash)) continue;
      if (input.hash !== null && version.hash !== input.hash) continue;
      return { sourceId: row.id };
    }
    return null;
  }

  sourceUrl(sourceId: string): string {
    return this.source(sourceId).row.url;
  }

  private async verifyForDetail(
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

  private async refreshOne(row: MarketSourceRow): Promise<void> {
    const fetched = await this.fetchIndex(row.url);
    const index = await verifyIndex({ ...fetched, expectedKey: row.publicKey, lastSerial: row.lastSerial });
    this.deps.db.setFetched(row.id, { serial: index.serial, ...fetched, at: this.deps.now() });
    this.indexes.set(row.id, index);
    const revoked = new Map(index.revoked.map((r) => [r.hash, r.reason]));
    for (const item of this.deps.registry.installed()) {
      const reason = revoked.get(item.v.hash);
      if (reason === undefined || item.v.source?.sourceId !== row.id || item.v.revoked !== null) continue;
      this.deps.registry.revoke(item.id, item.version, reason, this.deps.now());
      this.deps.notify({ title: `Composant révoqué : ${item.title}`, body: reason });
    }
  }

  private async fetchIndex(url: string): Promise<{ bytes: Uint8Array; sig: string }> {
    const base = withSlash(url);
    const limits = (maxBytes: number) => ({ timeoutMs: MARKET_FETCH_TIMEOUT_MS, maxBytes });
    const bytes = await this.deps.get(new URL("index.json", base).href, limits(INDEX_MAX_BYTES));
    const sig = await this.deps.get(new URL("index.json.sig", base).href, limits(SIG_MAX_BYTES));
    return { bytes, sig: new TextDecoder().decode(sig).trim() };
  }

  private source(sourceId: string): { row: MarketSourceRow; index: MarketIndex } {
    const row = this.deps.db.source(sourceId);
    const index = this.indexes.get(sourceId);
    if (!row || !index) throw new KiboError("NOT_FOUND", `market source ${sourceId} has no verified index`);
    return { row, index };
  }

  private async download(
    row: MarketSourceRow,
    index: MarketIndex,
    id: string,
    version: string,
  ): Promise<Kpkg> {
    const entry = index.packages.find((p) => p.id === id)?.versions.find((v) => v.version === version);
    if (!entry) throw new KiboError("NOT_FOUND", `${id}@${version} is not in ${row.id}`);
    const bytes = await this.deps.get(new URL(entry.url, row.url).href, {
      timeoutMs: MARKET_FETCH_TIMEOUT_MS,
      maxBytes: KPKG_MAX_RAW_BYTES,
    });
    return decodeKpkg(bytes);
  }
}
