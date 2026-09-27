import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError, type MarketIndex } from "@kibo/schema";
import { generateKeyPair, type KeyPair, signPublisherClaim, verifyIndex } from "@kibo/trust";
import { createInvite, redeemDeviceInvite } from "../accounts";
import { openServerDb, type ServerDb } from "../db";
import { initMarketSource, TeamMarket } from "./team-market";

export const KIT_NOW = 1_800_000_000_000;
export const KIT_SOURCE = { id: "equipe", name: "Équipe" };

export const outcome = (p: Promise<unknown>): Promise<string> =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof KiboError ? e.code : "no-code"),
  );

export function claimFor(keys: KeyPair, userId: string, sourceId = KIT_SOURCE.id): Promise<string> {
  return signPublisherClaim({ sourceId, userId, privateKey: keys.privateKey });
}

export class MarketKit {
  market: TeamMarket;

  private constructor(
    readonly dir: string,
    readonly sdb: ServerDb,
    readonly sourceKey: string,
    market: TeamMarket,
  ) {
    this.market = market;
  }

  static async create(prefix: string): Promise<MarketKit> {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    const sdb = openServerDb(join(dir, "sync.db"));
    const { publicKey } = await initMarketSource(dir, KIT_SOURCE);
    const market = await TeamMarket.open(sdb, dir);
    if (!market) throw new Error("market source was not initialised");
    return new MarketKit(dir, sdb, publicKey, market);
  }

  async user(
    name: string,
    deviceKeys?: KeyPair,
  ): Promise<{ userId: string; deviceId: string; keys: KeyPair }> {
    const invite = await createInvite(this.sdb, { kind: "account", name, createdBy: "admin" }, KIT_NOW);
    const keys = deviceKeys ?? (await generateKeyPair());
    const joined = await redeemDeviceInvite(
      this.sdb,
      { code: invite.code, publicKey: keys.publicKey, deviceName: name },
      KIT_NOW,
    );
    return { userId: joined.userId, deviceId: joined.deviceId, keys };
  }

  async publishAs(pkg: { bytes: Uint8Array; keys: KeyPair }, userId: string, now = KIT_NOW) {
    const publisherClaim = await claimFor(pkg.keys, userId);
    return this.market.publish(pkg.bytes, { userId, publisherClaim }, now);
  }

  async reopen(): Promise<TeamMarket> {
    const market = await TeamMarket.open(this.sdb, this.dir);
    if (!market) throw new Error("market source was not initialised");
    this.market = market;
    return market;
  }

  index(lastSerial: number | null = null): Promise<MarketIndex> {
    return verifyIndex({ ...this.market.index(), expectedKey: this.sourceKey, lastSerial });
  }

  close(): void {
    this.sdb.close();
    rmSync(this.dir, { recursive: true, force: true });
  }
}
