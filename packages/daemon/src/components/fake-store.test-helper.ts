import { readSources } from "@kibo/devkit";
import { ComponentManifest, KiboError } from "@kibo/schema";
import type { ComponentStore, StoredVersion } from "./store";

export type FakeStore = ComponentStore & {
  add(v: StoredVersion): void;
  tamper(id: string, version: string): void;
};

export function storedVersion(
  manifest: ComponentManifest,
  hash: string,
  server: string | null = null,
): StoredVersion {
  const enc = (s: string) => new TextEncoder().encode(s);
  return {
    id: manifest.id,
    version: manifest.version,
    hash,
    manifest,
    build: {
      "ui.sandbox.js": enc(`sandbox:${manifest.id}@${manifest.version}`),
      "ui.trusted.js": enc(`trusted:${manifest.id}@${manifest.version}`),
      "ui.css": enc(".c{}"),
      ...(server !== null && { "server.js": enc(server) }),
    },
  };
}

export function createFakeStore(): FakeStore {
  const disk = new Map<string, StoredVersion>();
  const tampered = new Set<string>();
  const cache = new Map<string, StoredVersion>();
  const key = (id: string, version: string) => `${id}@${version}`;
  const load = async (id: string, version: string, hash: string) => {
    const v = disk.get(key(id, version));
    if (!v || v.hash !== hash || tampered.has(key(id, version)))
      throw new KiboError("TRUST_REQUIRED", `${id}@${version} tampered`);
    cache.set(key(id, version), v);
    return v;
  };
  return {
    root: "/fake",
    add: (v) => {
      disk.set(key(v.id, v.version), v);
    },
    tamper: (id, version) => {
      tampered.add(key(id, version));
    },
    put: async (srcDir, expectedHash) => {
      const { hash, files } = await readSources(srcDir);
      if (expectedHash !== undefined && expectedHash !== hash)
        throw new KiboError("HASH_MISMATCH", "sources changed");
      const raw = files.find((f) => f.path === "kibo.component.json");
      const manifest = ComponentManifest.parse(
        JSON.parse(new TextDecoder().decode(raw?.bytes ?? new Uint8Array())),
      );
      const v = storedVersion(manifest, hash);
      disk.set(key(v.id, v.version), v);
      cache.set(key(v.id, v.version), v);
      return v;
    },
    load,
    verify: async (id, version, hash) => {
      try {
        await load(id, version, hash);
        return true;
      } catch (e) {
        if (!(e instanceof KiboError && e.code === "TRUST_REQUIRED")) throw e;
        cache.delete(key(id, version));
        return false;
      }
    },
    get: (id, version) => cache.get(key(id, version)),
    remove: async (id, version) => {
      disk.delete(key(id, version));
      cache.delete(key(id, version));
    },
  };
}
