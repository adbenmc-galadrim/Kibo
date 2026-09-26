import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KiboError, type Kpkg, Sha256, SyncId } from "@kibo/schema";
import {
  decodeKpkg,
  generateKeyPair,
  keyFingerprint,
  kpkgSourceFiles,
  parsePublicKey,
  signIndex,
  verifyKpkgSignature,
} from "@kibo/trust";
import { z } from "zod";
import { audit } from "../audit";
import type { ServerDb } from "../db";
import { validate } from "../validate";
import { CleanText } from "./clean-text";
import { buildMarketIndex, type IndexedPackage } from "./index-builder";
import { type MarketRole, MarketStore, type RevokedRow } from "./market-store";
import { assertPublisher, publisherNameKey } from "./publisher-rules";

export const MARKET_SOURCE_FILE = "market-source.json";

const SourceIdentity = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  name: CleanText(64),
});
const SourceFile = SourceIdentity.extend({ publicKey: z.string().min(1), privateKey: z.string().min(1) });
type SourceKeys = z.infer<typeof SourceFile>;

const Grant = z.object({ userId: SyncId, role: z.enum(["owner", "publisher"]) });
const Actor = z.object({ userId: SyncId, publisherClaim: z.string().optional() });
type Actor = z.infer<typeof Actor>;
type SignedIndex = { serial: number; bytes: Uint8Array<ArrayBuffer>; sig: string };
export const RevokeInput = z.object({ hash: Sha256, reason: CleanText(500) });
export type RevokeInput = z.infer<typeof RevokeInput>;

type PendingChange = {
  added?: IndexedPackage;
  publisher?: { publicKey: string; name: string };
  revoked?: RevokedRow;
};

export async function initMarketSource(
  dataDir: string,
  input: { id: string; name: string },
): Promise<{ publicKey: string; fingerprint: string }> {
  const identity = validate(SourceIdentity, input);
  const file = join(dataDir, MARKET_SOURCE_FILE);
  if (existsSync(file)) throw new KiboError("INVALID_INPUT", "market source is already initialised");
  const keys = await generateKeyPair();
  const content: SourceKeys = { ...identity, ...keys };
  writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  chmodSync(file, 0o600);
  return { publicKey: keys.publicKey, fingerprint: await keyFingerprint(keys.publicKey) };
}

function readSourceFile(file: string): SourceKeys {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `cannot read ${file}: ${String(e)}`);
  }
  const parsed = SourceFile.safeParse(raw);
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `${file} is not a market source`);
  return parsed.data;
}

export class TeamMarket {
  private queue: Promise<unknown> = Promise.resolve();
  private cached: SignedIndex | null = null;

  private constructor(
    private readonly sdb: ServerDb,
    private readonly store: MarketStore,
    private readonly keys: SourceKeys,
  ) {}

  static async open(sdb: ServerDb, dataDir: string): Promise<TeamMarket | null> {
    const file = join(dataDir, MARKET_SOURCE_FILE);
    if (!existsSync(file)) return null;
    const market = new TeamMarket(sdb, new MarketStore(sdb), readSourceFile(file));
    if (market.store.signedIndex() === null) await market.commit(Date.now(), {}, () => {});
    return market;
  }

  source(): { id: string; name: string; publicKey: string } {
    return { id: this.keys.id, name: this.keys.name, publicKey: this.keys.publicKey };
  }

  grant(userId: string, role: MarketRole): void {
    const input = validate(Grant, { userId, role });
    if (!this.store.userExists(input.userId)) throw new KiboError("NOT_FOUND", "user not found");
    this.store.setRole(input.userId, input.role);
  }

  ungrant(userId: string): void {
    this.store.setRole(validate(SyncId, userId), null);
  }

  publish(kpkg: Uint8Array, actor: Actor, now: number): Promise<{ serial: number }> {
    return this.exclusive(() => this.publishNow(kpkg, validate(Actor, actor), now));
  }

  revoke(input: RevokeInput, actor: { userId: string }, now: number): Promise<{ serial: number }> {
    return this.exclusive(() =>
      this.revokeNow(validate(RevokeInput, input), validate(Actor, actor).userId, now),
    );
  }

  index(): SignedIndex {
    const serial = this.store.serial();
    if (this.cached?.serial === serial) return this.cached;
    const row = this.store.signedIndex();
    if (!row) throw new KiboError("STORE_CORRUPT", "market index is missing");
    this.cached = { serial, bytes: new TextEncoder().encode(row.indexJson), sig: row.sig };
    return this.cached;
  }

  packageBytes(id: string, version: string): Uint8Array<ArrayBuffer> | null {
    return this.store.packageBytes(id, version);
  }

  private async publishNow(bytes: Uint8Array, actor: Actor, now: number): Promise<{ serial: number }> {
    const { userId } = actor;
    if (this.store.role(userId) === null) {
      throw new KiboError("FORBIDDEN", "publishing needs the publisher or owner role");
    }
    const pkg = decodeKpkg(bytes);
    parsePublicKey(pkg.publisher.publicKey);
    await verifyKpkgSignature(pkg);
    await kpkgSourceFiles(pkg);
    const { known } = await assertPublisher(this.store, {
      pkg,
      userId,
      sourceId: this.keys.id,
      claim: actor.publisherClaim,
    });
    const row = { ...indexedRow(pkg, bytes.byteLength), userId, bytes };
    const { name, publicKey } = pkg.publisher;
    const publisher = { publicKey, userId, name, nameKey: publisherNameKey(name) };
    const serial = await this.commit(now, { added: row, publisher: known ? undefined : publisher }, () => {
      if (!known) this.store.insertPublisher(publisher);
      this.store.insertPackage(row);
      const detail = `${pkg.manifest.id}@${pkg.manifest.version} ${pkg.hash}`;
      audit(this.sdb, { at: now, kind: "market-published", userId, detail });
    });
    return { serial };
  }

  private async revokeNow(input: RevokeInput, userId: string, now: number): Promise<{ serial: number }> {
    const role = this.store.role(userId);
    const owner = this.store.packageOwner(input.hash);
    if (role === null) throw new KiboError("FORBIDDEN", "revoking needs the publisher or owner role");
    if (owner === null) throw new KiboError("NOT_FOUND", `no package with hash ${input.hash}`);
    if (role !== "owner" && owner !== userId) {
      throw new KiboError("FORBIDDEN", "only the source owner or the publisher can revoke");
    }
    if (this.store.isRevoked(input.hash)) throw new KiboError("INVALID_INPUT", "package is already revoked");
    const serial = await this.commit(now, { revoked: input }, () => {
      this.store.insertRevoked({ ...input, at: now, by: userId });
      audit(this.sdb, { at: now, kind: "market-revoked", userId, detail: `${input.hash} ${input.reason}` });
    });
    return { serial };
  }

  private async commit(now: number, change: PendingChange, apply: () => void): Promise<number> {
    const previous = this.store.serial();
    const serial = previous + 1;
    const index = buildMarketIndex({
      source: this.source(),
      serial,
      now,
      packages: [...this.store.packages(), ...(change.added ? [change.added] : [])],
      publishers: [...this.store.publishers(), ...(change.publisher ? [change.publisher] : [])],
      revoked: [...this.store.revoked(), ...(change.revoked ? [change.revoked] : [])],
    });
    const { bytes, sig } = await signIndex(index, this.keys.privateKey);
    this.store.transaction(() => {
      apply();
      this.store.writeIndex(previous, { serial, indexJson: new TextDecoder().decode(bytes), sig });
    });
    return serial;
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}

function indexedRow(pkg: Kpkg, size: number): IndexedPackage {
  return {
    id: pkg.manifest.id,
    version: pkg.manifest.version,
    hash: pkg.hash,
    publisherKey: pkg.publisher.publicKey,
    manifestJson: JSON.stringify(pkg.manifest),
    size,
    publishedAt: pkg.publishedAt,
  };
}
