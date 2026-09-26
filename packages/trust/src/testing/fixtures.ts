import {
  ComponentManifest,
  type ComponentManifestInput,
  grantedOf,
  type Kpkg,
  type MarketIndex,
} from "@kibo/schema";
import { utf8 } from "../bytes";
import { generateKeyPair, type KeyPair } from "../ed25519";
import { encodeKpkg, packKpkg } from "../kpkg";
import { signIndex } from "../market-index";
import type { SourceFile } from "../source-hash";

export type { ComponentManifestInput };
export { generateKeyPair };

const FIXTURE_DATE = new Date("2026-09-26T10:00:00.000Z");

export type TestPackageInput = {
  id?: string;
  version?: string;
  title?: string;
  files?: Record<string, string>;
  manifest?: Partial<ComponentManifestInput>;
  publisherName?: string;
  keys?: KeyPair;
  publisher?: { name: string; keys: KeyPair };
  publishedAt?: Date;
};

export type TestPackage = {
  pkg: Kpkg;
  bytes: Uint8Array;
  keys: KeyPair;
  files: SourceFile[];
  publisher: { name: string; keys: KeyPair };
};

export type TestIndexInput = {
  source: { id: string; name: string; keys: KeyPair };
  serial: number;
  packages: { pkg: Kpkg; verified?: boolean }[];
  revoked?: { hash: string; reason: string }[];
  now?: Date;
};

export async function makeTestPackage(input: TestPackageInput = {}): Promise<TestPackage> {
  const keys = input.publisher?.keys ?? input.keys ?? (await generateKeyPair());
  const publisherName = input.publisher?.name ?? input.publisherName ?? "Léa";
  const title = input.title ?? input.manifest?.title ?? "Burndown";
  const manifest = ComponentManifest.parse({
    id: input.id ?? "burndown",
    version: input.version ?? "0.3.0",
    kind: "widget",
    title,
    description: "Avancement du sprint",
    reads: ["ticket", "status"],
    writes: [],
    ...input.manifest,
  });
  const sources: Record<string, string> = {
    "kibo.component.json": JSON.stringify(manifest, null, 2),
    "ui.tsx": `export function Component() {\n  return <p>${title}</p>;\n}\n`,
    ...input.files,
  };
  const files = Object.entries(sources).map(([path, text]) => ({ path, bytes: utf8(text) }));
  const pkg = await packKpkg({
    manifest,
    files,
    publisherName,
    keys,
    publishedAt: input.publishedAt ?? FIXTURE_DATE,
  });
  return { pkg, bytes: encodeKpkg(pkg), keys, files, publisher: { name: publisherName, keys } };
}

function indexPublishers(packages: TestIndexInput["packages"]): MarketIndex["publishers"] {
  const publishers = new Map<string, MarketIndex["publishers"][number]>();
  for (const { pkg, verified } of packages) {
    const { publicKey, name } = pkg.publisher;
    publishers.set(publicKey, { publicKey, name, verified: verified ?? true });
  }
  return [...publishers.values()];
}

function indexEntry(id: string, pkgs: Kpkg[]): MarketIndex["packages"][number] {
  const latest = pkgs[pkgs.length - 1];
  if (!latest) throw new Error(`no version for ${id}`);
  return {
    id,
    title: latest.manifest.title,
    description: latest.manifest.description ?? "",
    kind: latest.manifest.kind,
    versions: pkgs.map((p) => ({
      version: p.manifest.version,
      hash: p.hash,
      publisherKey: p.publisher.publicKey,
      size: encodeKpkg(p).byteLength,
      permissions: grantedOf(p.manifest),
      publishedAt: p.publishedAt,
      url: `packages/${id}/${p.manifest.version}.kpkg`,
    })),
  };
}

export async function makeTestIndex(
  input: TestIndexInput,
): Promise<{ index: MarketIndex; bytes: Uint8Array; sig: string }> {
  const byId = new Map<string, Kpkg[]>();
  for (const { pkg } of input.packages) {
    byId.set(pkg.manifest.id, [...(byId.get(pkg.manifest.id) ?? []), pkg]);
  }
  const index: MarketIndex = {
    format: 1,
    source: { id: input.source.id, name: input.source.name, publicKey: input.source.keys.publicKey },
    serial: input.serial,
    generatedAt: (input.now ?? FIXTURE_DATE).toISOString(),
    publishers: indexPublishers(input.packages),
    packages: [...byId.entries()].map(([id, pkgs]) => indexEntry(id, pkgs)),
    revoked: input.revoked ?? [],
  };
  const signed = await signIndex(index, input.source.keys.privateKey);
  return { index, ...signed };
}
