import { describe, expect, mock, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { osSandbox, validateComponent } from "@kibo/devkit";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { KiboError, type ValidationReport } from "@kibo/schema";
import { sha256Hex, toBase64, utf8 } from "@kibo/trust";
import { createPublishLock } from "../components/publish-lock";
import { okReport } from "../components/service.test-helper";
import { type InstallDeps, installFromMarket } from "./install";
import {
  expectNothingWritten,
  installDeps,
  publishPackage,
  REF,
  sandboxAvailable,
  storeDir as storeDirOf,
  useInstallBed,
} from "./install.test-helper";

const bed = useInstallBed();
const deps = (over: Partial<InstallDeps> = {}) => installDeps(bed(), over);
const publish = (files?: Record<string, string>) => publishPackage(bed(), files);
const nothingWritten = () => expectNothingWritten(bed());
const storeDir = () => storeDirOf(bed());

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
    expect(bed().registry.port.get("burndown", "0.1.0")).toMatchObject({
      origin: "marketplace",
      trust: null,
      approvedHash: null,
      autoUpdate: false,
      hash: made.pkg.hash,
      source: { sourceId: "equipe", publisherKey: made.publisher.keys.publicKey },
      revoked: null,
    });
    expect(readdirSync(storeDir())).toEqual(["0.1.0"]);
    expect((await bed().market.getPackage(REF)).newPublisher).toBe(false);
    expect(readdirSync(join(bed().home, "tmp"))).toEqual([]);
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
    bed().fake.tamper("packages/burndown/0.1.0.kpkg", utf8(JSON.stringify(altered)));
    await expect(installFromMarket(deps(), REF)).rejects.toThrow("HASH_MISMATCH");
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
    await bed().fake.revoke(made.pkg.hash, "clé compromise");
    await bed().market.refresh("equipe");
    await expect(installFromMarket(deps(), REF)).rejects.toThrow("REVOKED");
    nothingWritten();
  });

  test("a revocation received during the validation is honoured", async () => {
    const made = await publish();
    const validate = async (dir: string) => {
      await bed().fake.revoke(made.pkg.hash, "clé compromise");
      await bed().market.refresh("equipe");
      return okReport(dir);
    };
    await expect(installFromMarket(deps({ validate }), REF)).rejects.toThrow("REVOKED");
    nothingWritten();
  });

  test("a source removed during the validation stops the install", async () => {
    await publish();
    const validate = async (dir: string) => {
      await bed().market.removeSource("equipe");
      return okReport(dir);
    };
    await expect(installFromMarket(deps({ validate }), REF)).rejects.toThrow("NOT_FOUND");
    nothingWritten();
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
    await bed().store.remove("burndown", "0.1.0");
    expect((await bed().market.getPackage(REF)).pinnedPublisher).toBe(made.publisher.keys.publicKey);
  });

  test.if(sandboxAvailable)("the real generic validation accepts the default test package", async () => {
    await publish();
    const validate = (dir: string) =>
      validateComponent(dir, { toolchain: DEV_TOOLCHAIN, conformanceOnly: true });
    const result = await installFromMarket(deps({ validate, sandbox: osSandbox() }), REF);
    expect(result.version).toBe("0.1.0");
  });
});
