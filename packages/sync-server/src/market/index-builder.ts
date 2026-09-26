import { ComponentManifest, compareSemver, grantedOf, KiboError, type MarketIndex } from "@kibo/schema";

export type IndexedPackage = {
  id: string;
  version: string;
  hash: string;
  publisherKey: string;
  manifestJson: string;
  size: number;
  publishedAt: string;
};

export type IndexContent = {
  source: MarketIndex["source"];
  serial: number;
  now: number;
  packages: IndexedPackage[];
  publishers: { publicKey: string; name: string }[];
  revoked: { hash: string; reason: string }[];
};

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function manifestOf(row: IndexedPackage): ComponentManifest {
  let json: unknown;
  try {
    json = JSON.parse(row.manifestJson);
  } catch (e) {
    throw new KiboError(
      "STORE_CORRUPT",
      `stored manifest of ${row.id}@${row.version} is not JSON: ${String(e)}`,
    );
  }
  const parsed = ComponentManifest.safeParse(json);
  if (!parsed.success) {
    throw new KiboError("STORE_CORRUPT", `stored manifest of ${row.id}@${row.version} is invalid`);
  }
  return parsed.data;
}

function packageEntry(id: string, rows: IndexedPackage[]): MarketIndex["packages"][number] {
  const sorted = [...rows].sort((a, b) => compareSemver(a.version, b.version));
  const withManifests = sorted.map((row) => ({ row, manifest: manifestOf(row) }));
  const latest = withManifests[withManifests.length - 1];
  if (!latest) throw new KiboError("STORE_CORRUPT", `market package ${id} has no version`);
  return {
    id,
    title: latest.manifest.title,
    description: latest.manifest.description ?? "",
    kind: latest.manifest.kind,
    versions: withManifests.map(({ row, manifest }) => ({
      version: row.version,
      hash: row.hash,
      publisherKey: row.publisherKey,
      size: row.size,
      permissions: grantedOf(manifest),
      publishedAt: row.publishedAt,
      url: `packages/${id}/${row.version}.kpkg`,
    })),
  };
}

export function buildMarketIndex(content: IndexContent): MarketIndex {
  const byId = new Map<string, IndexedPackage[]>();
  for (const row of content.packages) byId.set(row.id, [...(byId.get(row.id) ?? []), row]);
  return {
    format: 1,
    source: content.source,
    serial: content.serial,
    generatedAt: new Date(content.now).toISOString(),
    publishers: [...content.publishers]
      .sort((a, b) => byText(a.publicKey, b.publicKey))
      .map((p) => ({ publicKey: p.publicKey, name: p.name, verified: true })),
    packages: [...byId.entries()]
      .sort(([a], [b]) => byText(a, b))
      .map(([id, rows]) => packageEntry(id, rows)),
    revoked: content.revoked,
  };
}
