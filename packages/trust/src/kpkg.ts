import { ComponentManifest, KiboError, KPKG_MAX_BYTES, Kpkg, type KpkgFile } from "@kibo/schema";
import { fromBase64, sha256Hex, toBase64, utf8 } from "./bytes";
import { type KeyPair, signBytes, verifyBytes } from "./ed25519";
import { isHashedSource, type SourceFile, sourceHash } from "./source-hash";

const SEGMENT = /^[A-Za-z0-9._-]+$/;
const MANIFEST_FILE = "kibo.component.json";
const MAX_PATH_LENGTH = 256;
export const KPKG_MAX_RAW_BYTES = Math.ceil((KPKG_MAX_BYTES * 4) / 3) + 256 * 1024;
export const KPKG_MAX_FILES = 200;

const comparePaths = (a: { path: string }, b: { path: string }): number =>
  a.path < b.path ? -1 : a.path > b.path ? 1 : 0;

export function signingPayload(
  pkg: Pick<Kpkg, "manifest" | "hash" | "publisher" | "publishedAt">,
): Uint8Array {
  return utf8(
    `kibo-kpkg-v1\n${pkg.manifest.id}@${pkg.manifest.version}\n${pkg.hash}\n${pkg.publisher.publicKey}\n${pkg.publishedAt}`,
  );
}

export function assertPackagePath(path: string): void {
  const safe =
    path.length > 0 &&
    path.length <= MAX_PATH_LENGTH &&
    path.split("/").every((s) => SEGMENT.test(s) && !s.startsWith(".")) &&
    isHashedSource(path);
  if (!safe) throw new KiboError("INVALID_INPUT", `unsafe package path: ${JSON.stringify(path)}`);
}

function assertPackagePaths(files: readonly { path: string }[]): void {
  if (files.length > KPKG_MAX_FILES) {
    throw new KiboError("INVALID_INPUT", `package has more than ${KPKG_MAX_FILES} files`);
  }
  const seen = new Set<string>();
  const directories = new Set<string>();
  for (const { path } of files) {
    assertPackagePath(path);
    const folded = path.toLowerCase();
    if (seen.has(folded)) throw new KiboError("INVALID_INPUT", `duplicated package path: ${path}`);
    seen.add(folded);
    for (const directory of parentDirectories(folded)) directories.add(directory);
  }
  const conflict = [...seen].find((path) => directories.has(path));
  if (conflict !== undefined) {
    throw new KiboError("INVALID_INPUT", `package path is both a file and a directory: ${conflict}`);
  }
}

function parentDirectories(path: string): string[] {
  const segments = path.split("/");
  return segments.slice(1).map((_, i) => segments.slice(0, i + 1).join("/"));
}

function decodedLength(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

function assertDeclaredSize(files: readonly KpkgFile[]): void {
  assertTotalSize(files.reduce((sum, f) => sum + decodedLength(f.content), 0));
}

function assertTotalSize(total: number): void {
  if (total > KPKG_MAX_BYTES) {
    throw new KiboError("INVALID_INPUT", `package sources exceed ${KPKG_MAX_BYTES} bytes`);
  }
}

export async function packKpkg(input: {
  manifest: ComponentManifest;
  files: SourceFile[];
  publisherName: string;
  keys: KeyPair;
  publishedAt: Date;
}): Promise<Kpkg> {
  const files = [...input.files].sort(comparePaths);
  assertPackagePaths(files);
  assertTotalSize(files.reduce((sum, f) => sum + f.bytes.byteLength, 0));
  assertManifestMatches(input.manifest, files);
  const hash = sourceHash(files);
  const encoded = await Promise.all(
    files.map(async (f) => ({ path: f.path, sha256: await sha256Hex(f.bytes), content: toBase64(f.bytes) })),
  );
  const unsigned = {
    manifest: input.manifest,
    hash,
    publisher: { name: input.publisherName, publicKey: input.keys.publicKey },
    publishedAt: input.publishedAt.toISOString(),
  };
  const signature = await signBytes(input.keys.privateKey, signingPayload(unsigned));
  return Kpkg.parse({ format: 1, ...unsigned, files: encoded, signature });
}

export function encodeKpkg(pkg: Kpkg): Uint8Array {
  return utf8(JSON.stringify(pkg));
}

function parseJson(bytes: Uint8Array, what: string): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `${what} is not UTF-8 JSON: ${String(e)}`);
  }
}

export function decodeKpkg(bytes: Uint8Array): Kpkg {
  if (bytes.byteLength > KPKG_MAX_RAW_BYTES) {
    throw new KiboError("INVALID_INPUT", `package too large: ${bytes.byteLength} bytes`);
  }
  const parsed = Kpkg.safeParse(parseJson(bytes, "package"));
  if (!parsed.success) {
    throw new KiboError("INVALID_INPUT", `package does not match the kpkg format: ${parsed.error.message}`);
  }
  return parsed.data;
}

export async function verifyKpkgSignature(pkg: Kpkg): Promise<void> {
  const ok = await verifyBytes(pkg.publisher.publicKey, signingPayload(pkg), pkg.signature);
  if (!ok) {
    throw new KiboError(
      "SIGNATURE_INVALID",
      `signature of ${pkg.manifest.id}@${pkg.manifest.version} is invalid`,
    );
  }
}

async function decodeFile(file: KpkgFile): Promise<SourceFile> {
  const bytes = fromBase64(file.content);
  if ((await sha256Hex(bytes)) !== file.sha256) {
    throw new KiboError("HASH_MISMATCH", `sha256 of ${file.path} does not match`);
  }
  return { path: file.path, bytes };
}

function assertManifestMatches(manifest: ComponentManifest, files: SourceFile[]): void {
  const manifestFile = files.find((f) => f.path === MANIFEST_FILE);
  if (!manifestFile) throw new KiboError("INVALID_INPUT", `package has no ${MANIFEST_FILE}`);
  const declared = ComponentManifest.safeParse(parseJson(manifestFile.bytes, MANIFEST_FILE));
  if (!declared.success || !Bun.deepEquals(declared.data, manifest, true)) {
    throw new KiboError("INVALID_INPUT", `package manifest differs from ${MANIFEST_FILE}`);
  }
}

export async function kpkgSourceFiles(pkg: Kpkg): Promise<SourceFile[]> {
  assertPackagePaths(pkg.files);
  assertDeclaredSize(pkg.files);
  const files: SourceFile[] = [];
  for (const f of pkg.files) files.push(await decodeFile(f));
  files.sort(comparePaths);
  if (sourceHash(files) !== pkg.hash) {
    throw new KiboError(
      "HASH_MISMATCH",
      `recomputed hash of ${pkg.manifest.id}@${pkg.manifest.version} differs`,
    );
  }
  assertManifestMatches(pkg.manifest, files);
  return files;
}
