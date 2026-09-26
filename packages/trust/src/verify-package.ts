import { KiboError, type Kpkg, type MarketIndex } from "@kibo/schema";
import { kpkgSourceFiles, verifyKpkgSignature } from "./kpkg";
import type { SourceFile } from "./source-hash";

function indexedVersion(pkg: Kpkg, index: MarketIndex) {
  return index.packages
    .find((p) => p.id === pkg.manifest.id)
    ?.versions.find((v) => v.version === pkg.manifest.version && v.hash === pkg.hash);
}

export async function verifyMarketPackage(input: {
  pkg: Kpkg;
  index: MarketIndex;
  pinnedKey: string | null;
}): Promise<{ files: SourceFile[]; newPublisher: boolean }> {
  const { pkg, index, pinnedKey } = input;
  const ref = `${pkg.manifest.id}@${pkg.manifest.version}`;
  await verifyKpkgSignature(pkg);
  const files = await kpkgSourceFiles(pkg);
  const revoked = index.revoked.find((r) => r.hash === pkg.hash);
  if (revoked) throw new KiboError("REVOKED", `${ref} is revoked: ${revoked.reason}`);
  const entry = indexedVersion(pkg, index);
  if (!entry) {
    throw new KiboError(
      "NOT_FOUND",
      `${ref} with hash ${pkg.hash} is not in the index of ${index.source.id}`,
    );
  }
  if (entry.publisherKey !== pkg.publisher.publicKey) {
    throw new KiboError("SIGNATURE_INVALID", `${ref} is signed by a publisher the index does not list`);
  }
  if (pinnedKey !== null && pinnedKey !== pkg.publisher.publicKey) {
    throw new KiboError(
      "PUBLISHER_CHANGED",
      `publisher key of ${pkg.manifest.id} changed on ${index.source.id}`,
    );
  }
  return { files, newPublisher: pinnedKey === null };
}
