import { Base64, KiboError, type Kpkg } from "@kibo/schema";
import { verifyPublisherClaim } from "@kibo/trust";
import { z } from "zod";
import { validate } from "../validate";
import { isCleanText } from "./clean-text";
import type { MarketStore } from "./market-store";

export const PublisherClaim = z.string().min(1).max(128).pipe(Base64);

export const publisherNameKey = (name: string): string => name.normalize("NFKC").toLowerCase();

function assertPackageSlot(store: MarketStore, pkg: Kpkg): void {
  const { id, version } = pkg.manifest;
  if (store.isRevoked(pkg.hash)) throw new KiboError("REVOKED", `${id}@${version} has a revoked hash`);
  if (store.hasVersion(id, version)) {
    throw new KiboError("VERSION_EXISTS", `${id}@${version} is already published`);
  }
  if (store.publisherKeysOf(id).some((k) => k !== pkg.publisher.publicKey)) {
    throw new KiboError("PUBLISHER_CHANGED", `${id} is published by another key`);
  }
}

function assertNewPublisherName(store: MarketStore, name: string, userId: string): void {
  if (!isCleanText(name)) throw new KiboError("INVALID_INPUT", "publisher name is not clean text");
  if (store.nameTakenByOther(publisherNameKey(name), userId)) {
    throw new KiboError("INVALID_INPUT", "publisher name is already used by another user");
  }
}

async function assertClaim(
  input: { sourceId: string; userId: string; publicKey: string },
  claim: string | undefined,
): Promise<void> {
  if (claim === undefined) throw new KiboError("SIGNATURE_INVALID", "a new publisher key needs a claim");
  const signature = validate(PublisherClaim, claim);
  if (!(await verifyPublisherClaim({ ...input, signature }))) {
    throw new KiboError("SIGNATURE_INVALID", "publisher claim does not match this key, source and user");
  }
}

export async function assertPublisher(
  store: MarketStore,
  input: { pkg: Kpkg; userId: string; sourceId: string; claim: string | undefined },
): Promise<{ known: boolean }> {
  const { pkg, userId } = input;
  const { name, publicKey } = pkg.publisher;
  assertPackageSlot(store, pkg);
  const registered = store.publisher(publicKey);
  if (registered) {
    if (registered.userId !== userId)
      throw new KiboError("FORBIDDEN", "this publisher key belongs to another user");
    if (registered.name !== name) {
      throw new KiboError("INVALID_INPUT", `publisher name is frozen as ${JSON.stringify(registered.name)}`);
    }
    return { known: true };
  }
  assertNewPublisherName(store, name, userId);
  await assertClaim({ sourceId: input.sourceId, userId, publicKey }, input.claim);
  return { known: false };
}
