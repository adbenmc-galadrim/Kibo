import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildOutput } from "@kibo/devkit";
import { copyFixture, DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { ComponentManifest } from "@kibo/schema";
import { backendCodeOf, createComponentStore } from "./store";

const cleanups: (() => void)[] = [];
afterAll(() => {
  for (const c of cleanups) c();
});

function setup(real = false) {
  const home = mkdtempSync(join(tmpdir(), "kibo-store-"));
  const fixture = copyFixture("hello");
  cleanups.push(() => rmSync(home, { recursive: true, force: true }), fixture.dispose);
  const fakeBuild = async (): Promise<BuildOutput> => ({
    manifest: ComponentManifest.parse({
      id: "hello",
      version: "0.1.0",
      kind: "both",
      title: "Hello",
      reads: [],
      writes: [],
    }),
    files: {
      "ui.sandbox.js": new TextEncoder().encode("sandbox"),
      "ui.trusted.js": new TextEncoder().encode("trusted"),
      "ui.css": new TextEncoder().encode(".x{}"),
      "server.js": new TextEncoder().encode("module.exports.server={}"),
    },
  });
  const store = createComponentStore({
    home,
    toolchain: DEV_TOOLCHAIN,
    ...(real ? {} : { build: fakeBuild }),
  });
  return { home, src: fixture.dir, store };
}

describe("component store", () => {
  test("put copies the hashed sources, builds and locks the files", async () => {
    const { src, store } = setup();
    const v = await store.put(src);
    expect(v.manifest.id).toBe("hello");
    const dir = join(store.root, "hello", "0.1.0", v.hash);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    expect(statSync(join(dir, "source", "ui.tsx")).mode & 0o777).toBe(0o400);
    expect(statSync(join(dir, "build", "ui.sandbox.js")).mode & 0o777).toBe(0o400);
    expect(() => statSync(join(dir, "source", "component.test.tsx"))).toThrow();
    expect(backendCodeOf(v)).toEqual({ server: "module.exports.server={}", migrations: null });
    expect((await store.put(src)).hash).toBe(v.hash);
    expect(store.get("hello", "0.1.0")?.hash).toBe(v.hash);
  });
  test("a tampered source or build file fails verification", async () => {
    const { src, store } = setup();
    const v = await store.put(src);
    const dir = join(store.root, "hello", "0.1.0", v.hash);
    expect(await store.verify("hello", "0.1.0", v.hash)).toBe(true);
    const file = join(dir, "build", "ui.sandbox.js");
    chmodSync(file, 0o600);
    writeFileSync(file, "evil");
    expect(await store.verify("hello", "0.1.0", v.hash)).toBe(false);
    await expect(store.load("hello", "0.1.0", v.hash)).rejects.toThrow("TRUST_REQUIRED");
  });
  test("tampered sources are detected too, and a wrong expected hash is refused", async () => {
    const { src, store } = setup();
    const v = await store.put(src);
    const file = join(store.root, "hello", "0.1.0", v.hash, "source", "ui.tsx");
    chmodSync(file, 0o600);
    writeFileSync(file, "export const Component = () => null;");
    expect(await store.verify("hello", "0.1.0", v.hash)).toBe(false);
    await expect(store.put(src, "f".repeat(64))).rejects.toThrow("HASH_MISMATCH");
  });
  test("a corrupted build.json or a deleted build file fails verification", async () => {
    const { src, store } = setup();
    const v = await store.put(src);
    const dir = join(store.root, "hello", "0.1.0", v.hash);
    rmSync(join(dir, "build", "ui.css"));
    expect(await store.verify("hello", "0.1.0", v.hash)).toBe(false);
    const meta = join(dir, "build.json");
    chmodSync(meta, 0o600);
    writeFileSync(meta, "{not json");
    expect(await store.verify("hello", "0.1.0", v.hash)).toBe(false);
    writeFileSync(meta, JSON.stringify({ files: 42 }));
    expect(await store.verify("hello", "0.1.0", v.hash)).toBe(false);
  });
  test("a missing version is not verified and remove deletes it", async () => {
    const { src, store } = setup();
    const v = await store.put(src);
    await store.remove("hello", "0.1.0");
    expect(await store.verify("hello", "0.1.0", v.hash)).toBe(false);
    expect(store.get("hello", "0.1.0")).toBeUndefined();
  });
  test("the real build runs from the stored copy", async () => {
    const { src, store } = setup(true);
    const v = await store.put(src);
    expect(new TextDecoder().decode(v.build["ui.css"])).toContain(".bg-emerald-500");
  }, 60_000);
});
