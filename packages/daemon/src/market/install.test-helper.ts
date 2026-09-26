import { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, mock } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { osSandbox } from "@kibo/devkit";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { KiboError } from "@kibo/schema";
import { makeTestPackage } from "@kibo/trust/testing";
import { createPublishLock } from "../components/publish-lock";
import { fakeBuild, okReport } from "../components/service.test-helper";
import { type ComponentStore, createComponentStore } from "../components/store";
import { type FakeMarket, startFakeMarket } from "../testing/fake-market";
import { createMemoryRegistry } from "../testing/memory-registry";
import { createHttpGet } from "./http-get";
import type { InstallDeps } from "./install";
import { openMarketDb } from "./market-db";
import { type FetchedPackage, MarketService, type PackageRef } from "./market-service";

export const REF = { sourceId: "equipe", id: "burndown", version: "0.1.0" };

export const sandboxAvailable = await osSandbox()
  .ready()
  .then(
    () => true,
    (e: unknown) => {
      if (e instanceof KiboError && e.code === "SANDBOX_UNAVAILABLE") return false;
      throw e;
    },
  );

export type InstallBed = {
  fake: FakeMarket;
  home: string;
  market: MarketService;
  registry: ReturnType<typeof createMemoryRegistry>;
  store: ComponentStore;
  log: ReturnType<typeof mock>;
};

export function useInstallBed(): () => InstallBed {
  let current: InstallBed | null = null;
  beforeEach(async () => {
    const home = mkdtempSync(join(tmpdir(), "kibo-install-"));
    const registry = createMemoryRegistry();
    current = {
      home,
      fake: await startFakeMarket(),
      registry,
      store: createComponentStore({ home, toolchain: DEV_TOOLCHAIN, build: fakeBuild }),
      log: mock(() => {}),
      market: new MarketService({
        db: openMarketDb(new Database(":memory:")),
        get: createHttpGet({ allowLoopbackHttp: true, log: () => {} }),
        registry: registry.port,
        now: () => 42,
        notify: mock(() => {}),
        log: mock(() => {}),
        emit: () => {},
      }),
    };
  });
  afterEach(() => {
    current?.fake.stop();
    if (current) rmSync(current.home, { recursive: true, force: true });
    current = null;
  });
  return () => {
    if (!current) throw new Error("the install bed is only available inside a test");
    return current;
  };
}

export const installDeps = (bed: InstallBed, over: Partial<InstallDeps> = {}): InstallDeps => ({
  market: bed.market,
  store: bed.store,
  registry: bed.registry.port,
  validate: okReport,
  sandbox: { ready: async () => {} },
  lock: createPublishLock(),
  tmpRoot: join(bed.home, "tmp"),
  log: bed.log,
  ...over,
});

export async function publishPackage(bed: InstallBed, files?: Record<string, string>) {
  const made = await makeTestPackage({
    id: "burndown",
    version: "0.1.0",
    files,
    manifest: { title: "Burndown" },
  });
  await bed.fake.publish(made.bytes);
  await bed.market.addSource({ url: bed.fake.url, publicKey: bed.fake.publicKey });
  return made;
}

export function marketServing(
  bed: InstallBed,
  alter: (fetched: FetchedPackage) => FetchedPackage,
): InstallDeps["market"] {
  return {
    fetchVerified: async (ref: PackageRef) => alter(await bed.market.fetchVerified(ref)),
    assertListed: (ref, hash, key) => bed.market.assertListed(ref, hash, key),
    pinPublisher: (sourceId, id, key) => bed.market.pinPublisher(sourceId, id, key),
    unpinPublisher: (input) => bed.market.unpinPublisher(input),
    search: (input) => bed.market.search(input),
  };
}

export const storeDir = (bed: InstallBed) => join(bed.home, "components", "store", "burndown");

export function expectNothingWritten(bed: InstallBed): void {
  expect(existsSync(storeDir(bed))).toBe(false);
  expect(bed.registry.port.installed()).toEqual([]);
  const tmp = join(bed.home, "tmp");
  expect(existsSync(tmp) ? readdirSync(tmp) : []).toEqual([]);
}
