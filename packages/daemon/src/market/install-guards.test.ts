import { describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { NO_PERMISSIONS, type RegistryVersion } from "@kibo/schema";
import { utf8 } from "@kibo/trust";
import { okReport } from "../components/service.test-helper";
import { type InstallDeps, installFromMarket, purgeInstallDirs } from "./install";
import {
  expectNothingWritten,
  installDeps,
  marketServing,
  publishPackage,
  REF,
  storeDir as storeDirOf,
  useInstallBed,
} from "./install.test-helper";

const bed = useInstallBed();
const deps = (over: Partial<InstallDeps> = {}) => installDeps(bed(), over);
const publish = () => publishPackage(bed());
const nothingWritten = () => expectNothingWritten(bed());
const storeDir = () => storeDirOf(bed());
const failingRegistry = () => ({
  ...bed().registry.port,
  put: () => {
    throw new Error("disk full");
  },
});
const peerEntry = (hash: string): RegistryVersion => ({
  version: "0.1.0",
  hash,
  origin: "marketplace",
  trust: "sandboxed",
  approvedHash: hash,
  granted: NO_PERMISSIONS,
  publishedAt: 1,
  autoUpdate: false,
  source: { sourceId: "equipe", publisherKey: "peer" },
  revoked: null,
});

describe("installFromMarket guards", () => {
  test("a source path escaping the temporary folder is refused before any write", async () => {
    await publish();
    const escaping = marketServing(bed(), (f) => ({
      ...f,
      files: [{ path: "../escaped.ts", bytes: utf8("export {};\n") }],
    }));
    const validate = mock(okReport);
    await expect(installFromMarket(deps({ market: escaping, validate }), REF)).rejects.toThrow(
      "INVALID_INPUT",
    );
    expect(validate).not.toHaveBeenCalled();
    nothingWritten();
  });

  test("a package served under another id@version is refused", async () => {
    await publish();
    const other = marketServing(bed(), (f) => ({
      ...f,
      pkg: { ...f.pkg, manifest: { ...f.pkg.manifest, version: "0.2.0" } },
    }));
    const validate = mock(okReport);
    await expect(installFromMarket(deps({ market: other, validate }), REF)).rejects.toThrow("INVALID_INPUT");
    expect(validate).not.toHaveBeenCalled();
    nothingWritten();
  });

  test("an entry with another hash appearing during the validation is kept and the install fails", async () => {
    await publish();
    const peer = peerEntry("b".repeat(64));
    const validate = async (dir: string) => {
      bed().registry.port.put("burndown", "Burndown", peer);
      return okReport(dir);
    };
    await expect(installFromMarket(deps({ validate }), REF)).rejects.toThrow("VERSION_EXISTS");
    expect(bed().registry.port.get("burndown", "0.1.0")).toEqual(peer);
    expect(existsSync(join(storeDir(), "0.1.0"))).toBe(false);
    expect((await bed().market.getPackage(REF)).pinnedPublisher).toBeNull();
  });

  test("an entry with the same hash appearing during the validation is not overwritten", async () => {
    const made = await publish();
    const peer = peerEntry(made.pkg.hash);
    const validate = async (dir: string) => {
      bed().registry.port.put("burndown", "Burndown", peer);
      return okReport(dir);
    };
    await installFromMarket(deps({ validate }), REF);
    expect(bed().registry.port.get("burndown", "0.1.0")).toEqual(peer);
    expect(readdirSync(storeDir())).toEqual(["0.1.0"]);
  });

  test("an installed version already in the store is not validated again", async () => {
    await publish();
    await installFromMarket(deps(), REF);
    const validate = mock(okReport);
    const result = await installFromMarket(deps({ validate }), REF);
    expect(result.version).toBe("0.1.0");
    expect(validate).not.toHaveBeenCalled();
  });

  test("an installed version missing from the store is written again", async () => {
    const made = await publish();
    const peer = peerEntry(made.pkg.hash);
    bed().registry.port.put("burndown", "Burndown", peer);
    const validate = mock(okReport);
    await installFromMarket(deps({ validate }), REF);
    expect(validate).toHaveBeenCalledTimes(1);
    expect(await bed().store.verify("burndown", "0.1.0", made.pkg.hash)).toBe(true);
    expect(bed().registry.port.get("burndown", "0.1.0")).toEqual(peer);
  });

  test("a registry failure removes the stored copy and leaves no publisher pin", async () => {
    await publish();
    await expect(installFromMarket(deps({ registry: failingRegistry() }), REF)).rejects.toThrow("disk full");
    expect(existsSync(join(storeDir(), "0.1.0"))).toBe(false);
    const detail = await bed().market.getPackage(REF);
    expect(detail.pinnedPublisher).toBeNull();
    expect(detail.newPublisher).toBe(true);
  });

  test("a registry failure keeps an earlier publisher pin", async () => {
    const made = await publish();
    bed().market.pinPublisher("equipe", "burndown", made.publisher.keys.publicKey);
    await expect(installFromMarket(deps({ registry: failingRegistry() }), REF)).rejects.toThrow("disk full");
    expect((await bed().market.getPackage(REF)).pinnedPublisher).toBe(made.publisher.keys.publicKey);
  });

  test("a failed cleanup is logged and the original error is kept", async () => {
    await publish();
    const store = {
      put: bed().store.put,
      verify: bed().store.verify,
      remove: async () => {
        throw new Error("store locked");
      },
    };
    await expect(installFromMarket(deps({ registry: failingRegistry(), store }), REF)).rejects.toThrow(
      "disk full",
    );
    expect(bed().log).toHaveBeenCalledTimes(1);
    expect(String(bed().log.mock.calls[0]?.[1])).toContain("store locked");
  });
});

test("purgeInstallDirs removes leftover install folders only", async () => {
  const root = join(bed().home, "tmp", "market");
  mkdirSync(join(root, "install-a1", "lib"), { recursive: true });
  mkdirSync(join(root, "other"), { recursive: true });
  await purgeInstallDirs(root);
  expect(readdirSync(root)).toEqual(["other"]);
  await purgeInstallDirs(join(bed().home, "missing"));
});
