import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type BuildFile, type BuildOutput, buildComponent, readSources, type Toolchain } from "@kibo/devkit";
import { type BackendCode, ComponentManifest, KiboError } from "@kibo/schema";
import { z } from "zod";

export type StoredVersion = {
  id: string;
  version: string;
  hash: string;
  manifest: ComponentManifest;
  build: Partial<Record<BuildFile, Uint8Array>>;
};
export type ComponentStore = {
  root: string;
  put(srcDir: string, expectedHash?: string): Promise<StoredVersion>;
  load(id: string, version: string, hash: string): Promise<StoredVersion>;
  verify(id: string, version: string, hash: string): Promise<boolean>;
  get(id: string, version: string): StoredVersion | undefined;
  remove(id: string, version: string): Promise<void>;
};
export type StoreDeps = {
  home: string;
  toolchain: Toolchain;
  build?: (srcDir: string, t: Toolchain) => Promise<BuildOutput>;
  kiboVersion?: string;
  now?: () => number;
};

const BuildMeta = z.object({ files: z.record(z.string(), z.string()) });
const BUILD_FILES: BuildFile[] = ["ui.sandbox.js", "ui.trusted.js", "ui.css", "server.js", "migrations.js"];
const TSCONFIG = JSON.stringify({
  compilerOptions: { jsx: "react-jsx", module: "ESNext", target: "ES2022" },
});
const sha256 = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
const text = (b: Uint8Array | undefined) => (b ? new TextDecoder().decode(b) : null);

export const backendCodeOf = (v: StoredVersion): BackendCode => ({
  server: text(v.build["server.js"]),
  migrations: text(v.build["migrations.js"]),
});

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function readMeta(dir: string, label: string): Promise<z.infer<typeof BuildMeta>> {
  const parsed = BuildMeta.safeParse(parseJson(await readFile(join(dir, "build.json"), "utf8")));
  if (!parsed.success) throw new KiboError("TRUST_REQUIRED", `${label} build.json is corrupted`);
  return parsed.data;
}

async function readBuildFile(dir: string, name: BuildFile, label: string): Promise<Uint8Array> {
  const path = join(dir, "build", name);
  if (!existsSync(path)) throw new KiboError("TRUST_REQUIRED", `${label} build ${name} is missing`);
  return new Uint8Array(await readFile(path));
}

async function writeLocked(path: string, bytes: Uint8Array | string): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, bytes, { mode: 0o400 });
}

export function createComponentStore(deps: StoreDeps): ComponentStore {
  const root = join(deps.home, "components", "store");
  const build = deps.build ?? buildComponent;
  const cache = new Map<string, StoredVersion>();
  const key = (id: string, version: string) => `${id}@${version}`;
  const dirOf = (id: string, version: string, hash: string) => join(root, id, version, hash);

  const load = async (id: string, version: string, hash: string): Promise<StoredVersion> => {
    const dir = dirOf(id, version, hash);
    if (!existsSync(join(dir, "build.json")))
      throw new KiboError("TRUST_REQUIRED", `${id}@${version} is not in the store`);
    const sources = await readSources(join(dir, "source"));
    if (sources.hash !== hash)
      throw new KiboError("TRUST_REQUIRED", `${id}@${version} sources changed on disk`);
    const label = `${id}@${version}`;
    const meta = await readMeta(dir, label);
    const files: StoredVersion["build"] = {};
    for (const name of BUILD_FILES) {
      const expected = meta.files[name];
      if (expected === undefined) continue;
      const bytes = await readBuildFile(dir, name, label);
      if (sha256(bytes) !== expected)
        throw new KiboError("TRUST_REQUIRED", `${id}@${version} build ${name} changed on disk`);
      files[name] = bytes;
    }
    const manifestFile = sources.files.find((f) => f.path === "kibo.component.json");
    const manifest = ComponentManifest.parse(JSON.parse(text(manifestFile?.bytes) ?? "{}"));
    const stored = { id, version, hash, manifest, build: files };
    cache.set(key(id, version), stored);
    return stored;
  };

  return {
    root,
    async put(srcDir, expectedHash) {
      const sources = await readSources(srcDir);
      if (expectedHash !== undefined && sources.hash !== expectedHash) {
        throw new KiboError("HASH_MISMATCH", "sources changed since the preview");
      }
      const manifestFile = sources.files.find((f) => f.path === "kibo.component.json");
      const parsed = ComponentManifest.safeParse(JSON.parse(text(manifestFile?.bytes) ?? "{}"));
      if (!parsed.success) throw new KiboError("VALIDATION_FAILED", parsed.error.message);
      const { id, version } = parsed.data;
      const final = dirOf(id, version, sources.hash);
      if (existsSync(join(final, "build.json"))) return load(id, version, sources.hash);
      const staging = join(root, `.staging-${crypto.randomUUID()}`);
      try {
        await mkdir(join(staging, "source"), { recursive: true, mode: 0o700 });
        for (const f of sources.files) await writeLocked(join(staging, "source", f.path), f.bytes);
        await writeFile(join(staging, "tsconfig.json"), TSCONFIG, { mode: 0o400 });
        const out = await build(join(staging, "source"), deps.toolchain);
        const shas: Record<string, string> = {};
        for (const [name, bytes] of Object.entries(out.files)) {
          await writeLocked(join(staging, "build", name), bytes);
          shas[name] = sha256(bytes);
        }
        const meta = {
          kiboVersion: deps.kiboVersion ?? "0.4.0",
          builtAt: (deps.now ?? Date.now)(),
          files: shas,
        };
        await writeLocked(join(staging, "build.json"), JSON.stringify(meta));
        for (const d of [staging, join(staging, "source"), join(staging, "build")]) await chmod(d, 0o700);
        await mkdir(dirname(final), { recursive: true, mode: 0o700 });
        await rename(staging, final);
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
      return load(id, version, sources.hash);
    },
    load,
    async verify(id, version, hash) {
      try {
        await load(id, version, hash);
        return true;
      } catch (e) {
        if (e instanceof KiboError && (e.code === "TRUST_REQUIRED" || e.code === "VALIDATION_FAILED")) {
          cache.delete(key(id, version));
          return false;
        }
        throw e;
      }
    },
    get: (id, version) => cache.get(key(id, version)),
    async remove(id, version) {
      cache.delete(key(id, version));
      await rm(join(root, id, version), { recursive: true, force: true });
    },
  };
}
