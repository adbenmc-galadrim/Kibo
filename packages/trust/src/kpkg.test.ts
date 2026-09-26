import { describe, expect, test } from "bun:test";
import { KiboError, type KiboErrorCode, KPKG_MAX_BYTES, type Kpkg } from "@kibo/schema";
import { sha256Hex, toBase64, utf8 } from "./bytes";
import { generateKeyPair, signBytes } from "./ed25519";
import {
  assertPackagePath,
  decodeKpkg,
  encodeKpkg,
  kpkgSourceFiles,
  packKpkg,
  signingPayload,
  verifyKpkgSignature,
} from "./kpkg";
import { makeTestPackage } from "./testing/fixtures";

async function failure(p: Promise<unknown>): Promise<KiboError | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof KiboError) return e;
    throw e;
  }
}

async function rejectsWith(p: Promise<unknown>, expected: KiboErrorCode) {
  expect((await failure(p))?.code).toBe(expected);
}

async function extraFile(path: string, text = "export const x = 1;\n") {
  return { path, content: toBase64(utf8(text)), sha256: await sha256Hex(utf8(text)) };
}

describe("signingPayload", () => {
  test("follows spec H §3.1 exactly", async () => {
    const { pkg } = await makeTestPackage({ id: "burndown", version: "0.3.0" });
    const text = new TextDecoder().decode(signingPayload(pkg));
    expect(text).toBe(
      `kibo-kpkg-v1\nburndown@0.3.0\n${pkg.hash}\n${pkg.publisher.publicKey}\n${pkg.publishedAt}`,
    );
  });
});

describe("signature", () => {
  test("a freshly packed package verifies", async () => {
    const { pkg } = await makeTestPackage();
    expect(await failure(verifyKpkgSignature(pkg))).toBeNull();
  });
  test("an altered manifest version is refused", async () => {
    const { pkg } = await makeTestPackage();
    await rejectsWith(
      verifyKpkgSignature({ ...pkg, manifest: { ...pkg.manifest, version: "9.9.9" } }),
      "SIGNATURE_INVALID",
    );
  });
  test("an altered publishedAt is refused", async () => {
    const { pkg } = await makeTestPackage();
    await rejectsWith(
      verifyKpkgSignature({ ...pkg, publishedAt: "2030-01-01T00:00:00.000Z" }),
      "SIGNATURE_INVALID",
    );
  });
  test("a signature from another key is refused", async () => {
    const { pkg } = await makeTestPackage();
    const other = await generateKeyPair();
    const signature = await signBytes(other.privateKey, signingPayload(pkg));
    await rejectsWith(verifyKpkgSignature({ ...pkg, signature }), "SIGNATURE_INVALID");
  });
  test("a garbage signature is refused without throwing another code", async () => {
    const { pkg } = await makeTestPackage();
    await rejectsWith(verifyKpkgSignature({ ...pkg, signature: "AAAA" }), "SIGNATURE_INVALID");
  });
});

describe("assertPackagePath", () => {
  test("accepts nested hashed sources", () => {
    expect(() => assertPackagePath("lib/chart-v2.ts")).not.toThrow();
    expect(() => assertPackagePath("kibo.component.json")).not.toThrow();
  });
  for (const path of ["", "a//b.ts", "a/./b.ts", "x\0.ts", "node_modules/a.ts", "dist/a.ts", "é.ts"]) {
    test(`refuses ${JSON.stringify(path)}`, () => {
      expect(() => assertPackagePath(path)).toThrow("INVALID_INPUT");
    });
  }
  test("refuses an overlong path", () => {
    expect(() => assertPackagePath(`${"a".repeat(300)}.ts`)).toThrow("INVALID_INPUT");
  });
});

describe("content", () => {
  test("returns the sorted source files", async () => {
    const { pkg } = await makeTestPackage();
    const files = await kpkgSourceFiles(pkg);
    expect(files.map((f) => f.path)).toEqual(["kibo.component.json", "ui.tsx"]);
  });
  test("a modified file with a recomputed sha256 no longer matches the hash", async () => {
    const { pkg } = await makeTestPackage();
    const replaced = await extraFile("ui.tsx", "export function Burndown() { return 42; }\n");
    const files = pkg.files.map((f) => (f.path === "ui.tsx" ? replaced : f));
    await rejectsWith(kpkgSourceFiles({ ...pkg, files }), "HASH_MISMATCH");
  });
  test("a wrong per-file sha256 is refused", async () => {
    const { pkg } = await makeTestPackage();
    const files = pkg.files.map((f) => (f.path === "ui.tsx" ? { ...f, sha256: "0".repeat(64) } : f));
    await rejectsWith(kpkgSourceFiles({ ...pkg, files }), "HASH_MISMATCH");
  });
  for (const path of [
    "../evil.ts",
    "/abs.ts",
    "src/../x.ts",
    ".hidden.ts",
    "src/.cache/x.ts",
    "ui.test.tsx",
    "run.sh",
    "a\\b.ts",
    "README.md",
  ]) {
    test(`refuses the path ${path}`, async () => {
      const { pkg } = await makeTestPackage();
      await rejectsWith(
        kpkgSourceFiles({ ...pkg, files: [...pkg.files, await extraFile(path)] }),
        "INVALID_INPUT",
      );
    });
  }
  test("checks every path before decoding any file", async () => {
    const { pkg } = await makeTestPackage();
    const tampered = pkg.files.map((f) => ({ ...f, sha256: "0".repeat(64) }));
    const error = await failure(
      kpkgSourceFiles({ ...pkg, files: [...tampered, await extraFile("../evil.ts")] }),
    );
    expect(error?.code).toBe("INVALID_INPUT");
    expect(error?.detail).toContain("evil");
  });
  test("refuses duplicated paths", async () => {
    const { pkg } = await makeTestPackage();
    const first = pkg.files[0];
    if (!first) throw new Error("fixture has no file");
    await rejectsWith(kpkgSourceFiles({ ...pkg, files: [...pkg.files, first] }), "INVALID_INPUT");
  });
  test("refuses a package without kibo.component.json", async () => {
    const { pkg: reference } = await makeTestPackage();
    const pkg = await packKpkg({
      manifest: reference.manifest,
      files: [{ path: "ui.tsx", bytes: utf8("export function Component() {}\n") }],
      publisherName: "Léa",
      keys: await generateKeyPair(),
      publishedAt: new Date("2026-09-26T10:00:00.000Z"),
    });
    const error = await failure(kpkgSourceFiles(pkg));
    expect(error?.code).toBe("INVALID_INPUT");
    expect(error?.detail).toContain("kibo.component.json");
  });
  test("refuses a manifest that differs from kibo.component.json", async () => {
    const keys = await generateKeyPair();
    const { pkg } = await makeTestPackage({ keys });
    const manifest = { ...pkg.manifest, writes: ["ticket" as const] };
    const signature = await signBytes(keys.privateKey, signingPayload({ ...pkg, manifest }));
    await rejectsWith(kpkgSourceFiles({ ...pkg, manifest, signature }), "INVALID_INPUT");
  });
  test("refuses more than 200 files", async () => {
    const { pkg } = await makeTestPackage();
    const extra = await Promise.all(Array.from({ length: 199 }, (_, i) => extraFile(`f${i}.ts`)));
    await rejectsWith(kpkgSourceFiles({ ...pkg, files: [...pkg.files, ...extra] }), "INVALID_INPUT");
  });
  test("refuses to pack more than 200 files", async () => {
    const many = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`f${i}.ts`, "export const x = 1;\n"]),
    );
    await rejectsWith(makeTestPackage({ files: many }), "INVALID_INPUT");
  });
  test("refuses to pack an unsafe path", async () => {
    await rejectsWith(makeTestPackage({ files: { "../evil.ts": "export {};\n" } }), "INVALID_INPUT");
  });
  test("refuses more than 2 MiB of decoded sources", async () => {
    const big = "x".repeat(KPKG_MAX_BYTES);
    const { pkg } = await makeTestPackage({ files: { "big.ts": `export const s = "${big}";\n` } });
    await rejectsWith(kpkgSourceFiles(pkg), "INVALID_INPUT");
  });
  test("bounds the declared size before decoding base64", async () => {
    const { pkg } = await makeTestPackage();
    const huge = { path: "huge.ts", sha256: "0".repeat(64), content: "A".repeat(KPKG_MAX_BYTES * 2) };
    await rejectsWith(kpkgSourceFiles({ ...pkg, files: [...pkg.files, huge] }), "INVALID_INPUT");
  });
});

describe("encoding", () => {
  test("round-trips through bytes", async () => {
    const { pkg } = await makeTestPackage();
    expect(decodeKpkg(encodeKpkg(pkg))).toEqual(pkg);
  });
  test("refuses non JSON bytes", () => {
    expect(() => decodeKpkg(utf8("not json"))).toThrow("INVALID_INPUT");
  });
  test("refuses invalid UTF-8", () => {
    expect(() => decodeKpkg(new Uint8Array([0x7b, 0xff, 0x7d]))).toThrow("INVALID_INPUT");
  });
  test("refuses a document that is not a kpkg", () => {
    expect(() => decodeKpkg(utf8(JSON.stringify({ format: 2 })))).toThrow("INVALID_INPUT");
  });
  test("refuses oversized raw bytes before parsing", () => {
    expect(() => decodeKpkg(new Uint8Array(KPKG_MAX_BYTES * 2))).toThrow("INVALID_INPUT");
  });
  test("keeps only known fields", async () => {
    const { pkg } = await makeTestPackage();
    const decoded: Kpkg = decodeKpkg(utf8(JSON.stringify({ ...pkg, extra: "ignored" })));
    expect(Object.keys(decoded)).not.toContain("extra");
  });
});
