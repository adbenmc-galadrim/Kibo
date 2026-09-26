import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { osSandbox, validateComponent } from "@kibo/devkit";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { KiboError, type ValidationReport } from "@kibo/schema";
import { sha256Hex, toBase64, utf8 } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { createPublishLock } from "../components/publish-lock";
import { fakeBuild, okReport } from "../components/service.test-helper";
import { type ComponentStore, createComponentStore } from "../components/store";
import { type FakeMarket, startFakeMarket } from "../testing/fake-market";
import { createMemoryRegistry } from "../testing/memory-registry";
import { createHttpGet } from "./http-get";
import { type InstallDeps, installFromMarket } from "./install";
import { openMarketDb } from "./market-db";
import { MarketService } from "./market-service";

const sandboxAvailable = await osSandbox()
  .ready()
  .then(
    () => true,
    (e: unknown) => {
      if (e instanceof KiboError && e.code === "SANDBOX_UNAVAILABLE") return false;
      throw e;
    },
  );

let fake: FakeMarket;
let home: string;
let market: MarketService;
let registry: ReturnType<typeof createMemoryRegistry>;
let store: ComponentStore;
const ready = { ready: async () => {} };
const REF = { sourceId: "equipe", id: "burndown", version: "0.1.0" };

const deps = (over: Partial<InstallDeps> = {}): InstallDeps => ({
  market,
  store,
  registry: registry.port,
  validate: okReport,
  sandbox: ready,
  lock: createPublishLock(),
  tmpRoot: join(home, "tmp"),
  ...over,
});

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), "kibo-install-"));
  fake = await startFakeMarket();
  registry = createMemoryRegistry();
  store = createComponentStore({ home, toolchain: DEV_TOOLCHAIN, build: fakeBuild });
  market = new MarketService({
    db: openMarketDb(new Database(":memory:")),
    get: createHttpGet({ allowLoopbackHttp: true, log: () => {} }),
    registry: registry.port,
    now: () => 42,
    notify: mock(() => {}),
    log: mock(() => {}),
    emit: () => {},
  });
});
afterEach(() => {
  fake.stop();
  rmSync(home, { recursive: true, force: true });
});

async function publish(files?: Record<string, string>) {
  const made = await makeTestPackage({
    id: "burndown",
    version: "0.1.0",
    files,
    manifest: { title: "Burndown" },
  });
  await fake.publish(made.bytes);
  await market.addSource({ url: fake.url, publicKey: fake.publicKey });
  return made;
}

const storeDir = () => join(home, "components", "store", "burndown");
const nothingWritten = () => {
  expect(existsSync(storeDir())).toBe(false);
  expect(registry.port.installed()).toEqual([]);
  expect(existsSync(join(home, "tmp")) ? readdirSync(join(home, "tmp")) : []).toEqual([]);
};

describe("installFromMarket", () => {
  test("installs a verified package without trust, pins its publisher and returns the screen 30 target", async () => {
    const made = await publish();
    const result = await installFromMarket(deps(), REF);
    expect(result).toMatchObject({
      id: "burndown",
      title: "Burndown",
      version: "0.1.0",
      hash: made.pkg.hash,
    });
    expect(result.market).toEqual({
      publisherName: made.publisher.name,
      verified: true,
      sourceName: "Équipe",
      newPublisher: true,
    });
    expect(registry.port.get("burndown", "0.1.0")).toMatchObject({
      origin: "marketplace",
      trust: null,
      approvedHash: null,
      autoUpdate: false,
      hash: made.pkg.hash,
      source: { sourceId: "equipe", publisherKey: made.publisher.keys.publicKey },
      revoked: null,
    });
    expect(readdirSync(storeDir())).toEqual(["0.1.0"]);
    expect((await market.getPackage(REF)).newPublisher).toBe(false);
    expect(readdirSync(join(home, "tmp"))).toEqual([]);
  });

  test("the generic validation runs on the written sources with conformanceOnly", async () => {
    await publish();
    const seen: string[] = [];
    await installFromMarket(
      deps({
        validate: async (dir) => {
          seen.push(...readdirSync(dir));
          return okReport(dir);
        },
      }),
      REF,
    );
    expect(seen).toContain("kibo.component.json");
    expect(seen.some((f) => f.endsWith(".test.tsx"))).toBe(false);
  });

  test("the sources are written in a private temporary folder", async () => {
    await publish({ "lib/chart.ts": "export const chart = 1;\n" });
    const modes: number[] = [];
    await installFromMarket(
      deps({
        validate: async (dir) => {
          modes.push(statSync(dir).mode & 0o777, statSync(join(dir, "lib")).mode & 0o777);
          modes.push(statSync(join(dir, "lib", "chart.ts")).mode & 0o777);
          return okReport(dir);
        },
      }),
      REF,
    );
    expect(modes).toEqual([0o700, 0o700, 0o600]);
  });

  test("a tampered file is refused and nothing is written", async () => {
    const made = await publish();
    const first = made.pkg.files[0];
    if (!first) throw new Error("fixture has no file");
    const content = utf8("export const Component = () => null;\n");
    const altered = {
      ...made.pkg,
      files: [
        { ...first, content: toBase64(content), sha256: await sha256Hex(content) },
        ...made.pkg.files.slice(1),
      ],
    };
    fake.tamper("packages/burndown/0.1.0.kpkg", utf8(JSON.stringify(altered)));
    await expect(installFromMarket(deps(), REF)).rejects.toThrow("HASH_MISMATCH");
    nothingWritten();
  });

  test("a source path escaping the temporary folder is refused before any write", async () => {
    await publish();
    const escaping: InstallDeps["market"] = {
      fetchVerified: async (ref) => ({
        ...(await market.fetchVerified(ref)),
        files: [{ path: "../escaped.ts", bytes: utf8("export {};\n") }],
      }),
      assertListed: (ref, hash) => market.assertListed(ref, hash),
      pinPublisher: (sourceId, id, key) => market.pinPublisher(sourceId, id, key),
      search: (input) => market.search(input),
    };
    const validate = mock(okReport);
    await expect(installFromMarket(deps({ market: escaping, validate }), REF)).rejects.toThrow(
      "INVALID_INPUT",
    );
    expect(validate).not.toHaveBeenCalled();
    nothingWritten();
  });

  test("a failed validation is refused and nothing is written", async () => {
    await publish();
    const failing = async (dir: string): Promise<ValidationReport> => ({
      ...(await okReport(dir)),
      typecheck: { ok: false, errors: ["ui.tsx:1 : Type 'string' is not assignable to type 'number'."] },
      ok: false,
    });
    await expect(installFromMarket(deps({ validate: failing }), REF)).rejects.toThrow("VALIDATION_FAILED");
    nothingWritten();
  });

  test("a validation that throws leaves nothing behind", async () => {
    await publish();
    const crashing = async (): Promise<ValidationReport> => {
      throw new KiboError("INTERNAL", "validation crashed");
    };
    await expect(installFromMarket(deps({ validate: crashing }), REF)).rejects.toThrow("INTERNAL");
    nothingWritten();
  });

  test("without OS isolation nothing is validated nor written", async () => {
    await publish();
    const validate = mock(okReport);
    const unavailable = {
      ready: async () => {
        throw new KiboError("SANDBOX_UNAVAILABLE", "no OS sandbox on test");
      },
    };
    await expect(installFromMarket(deps({ validate, sandbox: unavailable }), REF)).rejects.toThrow(
      "SANDBOX_UNAVAILABLE",
    );
    expect(validate).not.toHaveBeenCalled();
    nothingWritten();
  });

  test("a revoked version is refused and nothing is written", async () => {
    const made = await publish();
    await fake.revoke(made.pkg.hash, "clé compromise");
    await market.refresh("equipe");
    await expect(installFromMarket(deps(), REF)).rejects.toThrow("REVOKED");
    nothingWritten();
  });

  test("a revocation received during the validation is honoured", async () => {
    const made = await publish();
    const validate = async (dir: string) => {
      await fake.revoke(made.pkg.hash, "clé compromise");
      await market.refresh("equipe");
      return okReport(dir);
    };
    await expect(installFromMarket(deps({ validate }), REF)).rejects.toThrow("REVOKED");
    nothingWritten();
  });

  test("a source removed during the validation stops the install", async () => {
    await publish();
    const validate = async (dir: string) => {
      await market.removeSource("equipe");
      return okReport(dir);
    };
    await expect(installFromMarket(deps({ validate }), REF)).rejects.toThrow("NOT_FOUND");
    nothingWritten();
  });

  test("a registry failure removes the stored copy", async () => {
    await publish();
    const failing = {
      ...registry.port,
      put: () => {
        throw new Error("disk full");
      },
    };
    await expect(installFromMarket(deps({ registry: failing }), REF)).rejects.toThrow("disk full");
    expect(existsSync(join(storeDir(), "0.1.0"))).toBe(false);
  });

  test("an install and a publish of the same id never overlap", async () => {
    await publish();
    const lock = createPublishLock();
    let release: () => void = () => {};
    const held = lock.hold(
      "burndown",
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    );
    await expect(installFromMarket(deps({ lock }), REF)).rejects.toThrow("CONFLICT");
    release();
    await held;
    nothingWritten();
  });

  test("the pin survives an uninstall", async () => {
    const made = await publish();
    await installFromMarket(deps(), REF);
    await store.remove("burndown", "0.1.0");
    expect((await market.getPackage(REF)).pinnedPublisher).toBe(made.publisher.keys.publicKey);
  });

  test.if(sandboxAvailable)("the real generic validation accepts the default test package", async () => {
    await publish();
    const validate = (dir: string) =>
      validateComponent(dir, { toolchain: DEV_TOOLCHAIN, conformanceOnly: true });
    const result = await installFromMarket(deps({ validate, sandbox: osSandbox() }), REF);
    expect(result.version).toBe("0.1.0");
  });
});
