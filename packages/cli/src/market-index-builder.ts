import { existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compareSemver, grantedOf, KiboError, type Kpkg, type MarketIndex, Sha256 } from "@kibo/schema";
import { decodeKpkg, type KeyPair, kpkgSourceFiles, signIndex, verifyKpkgSignature } from "@kibo/trust";
import { z } from "zod";

const Revoked = z.array(z.object({ hash: Sha256, reason: z.string().min(1).max(500) }));
const Previous = z.object({ serial: z.number().int().positive() });
const SourceIdentity = z.object({ id: z.string().min(1).max(64), name: z.string().trim().min(1).max(64) });

type Loaded = { pkg: Kpkg; size: number; url: string };
export type StaticIndexInput = {
  dir: string;
  keys: KeyPair;
  id: string;
  name: string;
  verified: string[];
  now: Date;
};

function readJson<T>(file: string, schema: z.ZodType<T>): T {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new KiboError("INVALID_INPUT", `${file} is not JSON`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `${file} has an unexpected shape`);
  return parsed.data;
}

const subdirectories = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

function decodePackage(bytes: Uint8Array, path: string): Kpkg {
  try {
    return decodeKpkg(bytes);
  } catch {
    throw new KiboError("INVALID_INPUT", `${path} is not a valid kibo package`);
  }
}

async function loadPackage(root: string, id: string, file: string): Promise<Loaded> {
  const bytes = new Uint8Array(readFileSync(join(root, id, file)));
  const pkg = decodePackage(bytes, `packages/${id}/${file}`);
  if (pkg.manifest.id !== id || `${pkg.manifest.version}.kpkg` !== file) {
    throw new KiboError(
      "INVALID_INPUT",
      `packages/${id}/${file} contains ${pkg.manifest.id}@${pkg.manifest.version}`,
    );
  }
  await verifyKpkgSignature(pkg);
  await kpkgSourceFiles(pkg);
  return { pkg, size: bytes.byteLength, url: `packages/${id}/${file}` };
}

async function loadPackages(dir: string): Promise<Loaded[]> {
  const root = join(dir, "packages");
  if (!existsSync(root)) return [];
  const out: Loaded[] = [];
  for (const id of subdirectories(root)) {
    const files = readdirSync(join(root, id))
      .filter((f) => f.endsWith(".kpkg"))
      .sort();
    for (const file of files) out.push(await loadPackage(root, id, file));
  }
  return out;
}

function publishersOf(loaded: Loaded[], verified: string[]): MarketIndex["publishers"] {
  const names = new Map(loaded.map((l) => [l.pkg.publisher.publicKey, l.pkg.publisher.name]));
  return [...names.entries()].map(([publicKey, name]) => ({
    publicKey,
    name,
    verified: verified.includes(publicKey),
  }));
}

function entryOf(id: string, loaded: Loaded[]): MarketIndex["packages"][number] {
  const versions = loaded
    .filter((l) => l.pkg.manifest.id === id)
    .sort((a, b) => compareSemver(a.pkg.manifest.version, b.pkg.manifest.version));
  const latest = versions[versions.length - 1];
  if (!latest) throw new KiboError("INTERNAL", `no version for ${id}`);
  return {
    id,
    title: latest.pkg.manifest.title,
    description: latest.pkg.manifest.description ?? "",
    kind: latest.pkg.manifest.kind,
    versions: versions.map((l) => ({
      version: l.pkg.manifest.version,
      hash: l.pkg.hash,
      publisherKey: l.pkg.publisher.publicKey,
      size: l.size,
      permissions: grantedOf(l.pkg.manifest),
      publishedAt: l.pkg.publishedAt,
      url: l.url,
    })),
  };
}

function writeAtomically(file: string, content: Uint8Array | string): void {
  const tmp = `${file}.tmp`;
  rmSync(tmp, { force: true });
  writeFileSync(tmp, content, { mode: 0o644, flag: "wx" });
  renameSync(tmp, file);
}

export async function buildStaticIndex(
  input: StaticIndexInput,
): Promise<{ serial: number; packages: number }> {
  const identity = SourceIdentity.safeParse({ id: input.id, name: input.name });
  if (!identity.success)
    throw new KiboError("INVALID_INPUT", "source id and name must hold 1 to 64 characters");
  const loaded = await loadPackages(input.dir);
  const indexFile = join(input.dir, "index.json");
  const revokedFile = join(input.dir, "revoked.json");
  const previous = existsSync(indexFile) ? readJson(indexFile, Previous).serial : 0;
  const index: MarketIndex = {
    format: 1,
    source: { ...identity.data, publicKey: input.keys.publicKey },
    serial: previous + 1,
    generatedAt: input.now.toISOString(),
    publishers: publishersOf(loaded, input.verified),
    packages: [...new Set(loaded.map((l) => l.pkg.manifest.id))].map((id) => entryOf(id, loaded)),
    revoked: existsSync(revokedFile) ? readJson(revokedFile, Revoked) : [],
  };
  const signed = await signIndex(index, input.keys.privateKey);
  writeAtomically(join(input.dir, "index.json.sig"), `${signed.sig}\n`);
  writeAtomically(indexFile, signed.bytes);
  return { serial: index.serial, packages: loaded.length };
}
