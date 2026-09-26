import { GrantedPermissions, grantedOf, KiboError, type Kpkg, type MarketIndex } from "@kibo/schema";
import { kpkgSourceFiles, verifyKpkgSignature } from "./kpkg";
import type { SourceFile } from "./source-hash";

export type MarketPublisher = { name: string; verified: boolean };
export type VerifiedMarketPackage = {
  files: SourceFile[];
  newPublisher: boolean;
  publisher: MarketPublisher;
};
type IndexedVersion = MarketIndex["packages"][number]["versions"][number];

const refOf = (pkg: Kpkg): string => `${pkg.manifest.id}@${pkg.manifest.version}`;

function indexedVersion(pkg: Kpkg, index: MarketIndex): IndexedVersion {
  const revoked = index.revoked.find((r) => r.hash === pkg.hash);
  if (revoked) throw new KiboError("REVOKED", `${refOf(pkg)} is revoked: ${revoked.reason}`);
  const entry = index.packages
    .find((p) => p.id === pkg.manifest.id)
    ?.versions.find((v) => v.version === pkg.manifest.version && v.hash === pkg.hash);
  if (!entry) {
    throw new KiboError(
      "NOT_FOUND",
      `${refOf(pkg)} with hash ${pkg.hash} is not in the index of ${index.source.id}`,
    );
  }
  return entry;
}

function listedPublisher(pkg: Kpkg, entry: IndexedVersion, index: MarketIndex): MarketPublisher {
  const listed = index.publishers.find((p) => p.publicKey === entry.publisherKey);
  if (entry.publisherKey !== pkg.publisher.publicKey || !listed) {
    throw new KiboError(
      "SIGNATURE_INVALID",
      `${refOf(pkg)} is signed by a publisher the index does not list`,
    );
  }
  if (listed.name !== pkg.publisher.name) {
    throw new KiboError("SIGNATURE_INVALID", `publisher name of ${refOf(pkg)} differs from the index`);
  }
  return { name: listed.name, verified: listed.verified };
}

function assertPermissions(pkg: Kpkg, entry: IndexedVersion): void {
  const declared = GrantedPermissions.safeParse(entry.permissions);
  if (!declared.success || !Bun.deepEquals(declared.data, grantedOf(pkg.manifest), true)) {
    throw new KiboError("INVALID_INPUT", `index permissions of ${refOf(pkg)} differ from its manifest`);
  }
}

export async function verifyMarketPackage(input: {
  pkg: Kpkg;
  index: MarketIndex;
  pinnedKey: string | null;
}): Promise<VerifiedMarketPackage> {
  const { pkg, index, pinnedKey } = input;
  await verifyKpkgSignature(pkg);
  const entry = indexedVersion(pkg, index);
  const publisher = listedPublisher(pkg, entry, index);
  if (pinnedKey !== null && pinnedKey !== pkg.publisher.publicKey) {
    throw new KiboError(
      "PUBLISHER_CHANGED",
      `publisher key of ${pkg.manifest.id} changed on ${index.source.id}`,
    );
  }
  assertPermissions(pkg, entry);
  const files = await kpkgSourceFiles(pkg);
  return { files, newPublisher: pinnedKey === null, publisher };
}
