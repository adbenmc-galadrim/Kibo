import {
  type ComponentKind,
  KiboError,
  type Kpkg,
  type MarketHit,
  type MarketIndex,
  type MarketPackageDetail,
  type MarketProbe,
  type MarketSourceInfo,
  type RegistryVersion,
} from "@kibo/schema";
import {
  keyFingerprint,
  type MarketPublisher,
  parsePublicKey,
  type SourceFile,
  verifyIndex,
  verifyMarketPackage,
} from "@kibo/trust";
import type { Notice } from "../agents/notifier";
import type { HttpGet } from "./http-get";
import { createKeyedQueue } from "./keyed-queue";
import { assertListedIn } from "./listing";
import type { MarketDb, MarketSourceRow } from "./market-db";
import { downloadKpkg, fetchIndex, sourceBase, verifyForDetail, verifySourceIndex } from "./market-fetch";
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

export class MarketService {
  private readonly indexes = new Map<string, MarketIndex>();
  private readonly exclusive = createKeyedQueue();

  constructor(private readonly deps: MarketServiceDeps) {}

  async load(): Promise<void> {
    for (const { id } of this.deps.db.sources()) {
      try {
        await this.exclusive(id, () => this.loadOne(id));
      } catch (e) {
        this.deps.db.setError(id, errorMessage(e));
        this.deps.log(`market: cached index of ${id} rejected`, e);
      }
    }
  }

  listSources(): MarketSourceInfo[] {
    return this.deps.db.sources().map(sourceInfo);
  }

  async probe(url: string): Promise<MarketProbe> {
    const fetched = await fetchIndex(this.deps.get, sourceBase(url));
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
    const url = sourceBase(input.url);
    const fingerprint = await keyFingerprint(input.publicKey);
    const fetched = await fetchIndex(this.deps.get, url);
    const index = await verifyIndex({ ...fetched, expectedKey: input.publicKey, lastSerial: null });
    const id = index.source.id;
    assertSourceId(id);
    const row = await this.exclusive(id, async () => {
      const added = this.deps.db.addSource({
        id,
        url,
        name: index.source.name,
        publicKey: input.publicKey,
        fingerprint,
        lastSerial: null,
        lastFetchedAt: null,
        enabled: true,
        lastError: null,
      });
      if (!added) throw new KiboError("INVALID_INPUT", `market source ${id} already exists`);
      const at = this.deps.now();
      if (this.deps.db.setFetched(id, { serial: index.serial, ...fetched, at, publicKey: input.publicKey })) {
        this.indexes.set(id, index);
      }
      return this.deps.db.source(id);
    });
    if (!row) throw new KiboError("INTERNAL", `market source ${id} was not stored`);
    this.deps.emit();
    return sourceInfo(row);
  }

  async removeSource(id: string): Promise<void> {
    await this.exclusive(id, async () => {
      this.deps.db.removeSource(id);
      this.indexes.delete(id);
    });
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
        await this.exclusive(row.id, () => this.refreshOne(row.id));
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
    const { verified, publisherChanged } = await verifyForDetail(pkg, index, pinned);
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

  assertListed(input: PackageRef, hash: string, publisherKey: string): void {
    assertListedIn(this.source(input.sourceId).index, input, hash, publisherKey);
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

  private async loadOne(id: string): Promise<void> {
    const row = this.deps.db.source(id);
    const cached = this.deps.db.cachedIndex(id);
    if (!row || !cached) return;
    const index = await verifySourceIndex(row, cached);
    if (this.sameSource(row)) this.indexes.set(id, index);
  }

  private sameSource(row: MarketSourceRow): boolean {
    const current = this.deps.db.source(row.id);
    return current !== null && current.publicKey === row.publicKey && current.url === row.url;
  }

  private async refreshOne(id: string): Promise<void> {
    const row = this.deps.db.source(id);
    if (!row?.enabled) return;
    const fetched = await fetchIndex(this.deps.get, row.url);
    const index = await verifySourceIndex(row, fetched);
    const at = this.deps.now();
    if (
      !this.deps.db.setFetched(row.id, { serial: index.serial, ...fetched, at, publicKey: row.publicKey })
    ) {
      if (!this.sameSource(row)) return;
      throw new KiboError("INDEX_ROLLBACK", `a newer index of ${row.id} is already stored`);
    }
    this.indexes.set(row.id, index);
    const revoked = new Map(index.revoked.map((r) => [r.hash, r.reason]));
    for (const item of this.deps.registry.installed()) {
      const reason = revoked.get(item.v.hash);
      if (reason === undefined || item.v.source?.sourceId !== row.id || item.v.revoked !== null) continue;
      this.deps.registry.revoke(item.id, item.version, reason, this.deps.now());
      this.deps.notify({ title: `Composant révoqué : ${item.title}`, body: reason });
    }
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
    return downloadKpkg(this.deps.get, row.url, entry.url);
  }
}
