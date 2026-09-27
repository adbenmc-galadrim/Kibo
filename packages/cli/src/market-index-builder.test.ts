import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encodeKpkg, generateKeyPair, type KeyPair, verifyIndex } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { buildStaticIndex } from "./market-index-builder";

let dir: string;
let keys: KeyPair;
const now = new Date("2026-09-26T10:00:00Z");

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-static-"));
  keys = await generateKeyPair();
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

async function put(version: string, fileVersion = version) {
  const made = await makeTestPackage({ id: "burndown", version, manifest: { title: "Burndown" } });
  mkdirSync(join(dir, "packages", "burndown"), { recursive: true });
  writeFileSync(join(dir, "packages", "burndown", `${fileVersion}.kpkg`), made.bytes);
  return made;
}

const read = async (lastSerial: number | null) =>
  verifyIndex({
    bytes: new Uint8Array(readFileSync(join(dir, "index.json"))),
    sig: readFileSync(join(dir, "index.json.sig"), "utf8").trim(),
    expectedKey: keys.publicKey,
    lastSerial,
  });

describe("buildStaticIndex", () => {
  test("signs an index whose serial grows at each build", async () => {
    const made = await put("0.1.0");
    expect(
      await buildStaticIndex({
        dir,
        keys,
        id: "perso",
        name: "Perso",
        verified: [made.publisher.keys.publicKey],
        now,
      }),
    ).toEqual({
      serial: 1,
      packages: 1,
    });
    const first = await read(null);
    expect(first.packages[0]?.versions[0]?.url).toBe("packages/burndown/0.1.0.kpkg");
    expect(first.publishers[0]?.verified).toBe(true);
    await put("0.2.0");
    expect(
      (await buildStaticIndex({ dir, keys, id: "perso", name: "Perso", verified: [], now })).serial,
    ).toBe(2);
    expect((await read(1)).packages[0]?.versions.map((v) => v.version)).toEqual(["0.1.0", "0.2.0"]);
  });

  test("a tampered package aborts the build and keeps the previous index", async () => {
    await put("0.1.0");
    await buildStaticIndex({ dir, keys, id: "perso", name: "Perso", verified: [], now });
    const made = await put("0.2.0");
    const first = made.pkg.files[0];
    if (!first) throw new Error("fixture has no file");
    const tampered = {
      ...made.pkg,
      files: [{ ...first, content: btoa("changed") }, ...made.pkg.files.slice(1)],
    };
    writeFileSync(join(dir, "packages", "burndown", "0.2.0.kpkg"), encodeKpkg(tampered));
    await expect(
      buildStaticIndex({ dir, keys, id: "perso", name: "Perso", verified: [], now }),
    ).rejects.toThrow("HASH_MISMATCH");
    expect((await read(null)).serial).toBe(1);
  });

  test("a package stored under the wrong version is refused", async () => {
    await put("0.1.0", "0.3.0");
    await expect(
      buildStaticIndex({ dir, keys, id: "perso", name: "Perso", verified: [], now }),
    ).rejects.toThrow("INVALID_INPUT");
  });

  test("revoked.json is carried into the index", async () => {
    const made = await put("0.1.0");
    writeFileSync(join(dir, "revoked.json"), JSON.stringify([{ hash: made.pkg.hash, reason: "Faille" }]));
    await buildStaticIndex({ dir, keys, id: "perso", name: "Perso", verified: [], now });
    expect((await read(null)).revoked).toEqual([{ hash: made.pkg.hash, reason: "Faille" }]);
  });

  test("a symbolic link planted on the temporary file is never followed", async () => {
    await put("0.1.0");
    const target = join(dir, "victim.txt");
    writeFileSync(target, "intact");
    symlinkSync(target, join(dir, "index.json.tmp"));
    symlinkSync(target, join(dir, "index.json.sig.tmp"));
    await buildStaticIndex({ dir, keys, id: "perso", name: "Perso", verified: [], now });
    expect(readFileSync(target, "utf8")).toBe("intact");
    expect((await read(null)).serial).toBe(1);
  });

  test("a package that is not JSON is refused without leaking its content", async () => {
    mkdirSync(join(dir, "packages", "burndown"), { recursive: true });
    writeFileSync(join(dir, "packages", "burndown", "0.1.0.kpkg"), "SECRET-CONTENT {");
    const error = await buildStaticIndex({ dir, keys, id: "perso", name: "Perso", verified: [], now }).catch(
      (e: unknown) => e,
    );
    expect(String(error)).toContain("INVALID_INPUT");
    expect(String(error)).toContain("packages/burndown/0.1.0.kpkg");
    expect(String(error)).not.toContain("SECRET");
  });
});
