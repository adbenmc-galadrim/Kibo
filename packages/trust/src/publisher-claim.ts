import { KiboError } from "@kibo/schema";
import { utf8 } from "./bytes";
import { signBytes, verifyBytes } from "./ed25519";

export const PUBLISHER_CLAIM_HEADER = "x-kibo-publisher-claim";

const CONTROL = /\p{Cc}/u;

export function publisherClaimPayload(input: { sourceId: string; userId: string }): Uint8Array {
  if (CONTROL.test(input.sourceId) || CONTROL.test(input.userId)) {
    throw new KiboError("INVALID_INPUT", "control character in publisher claim");
  }
  return utf8(`kibo-publisher-claim-v1\n${input.sourceId}\n${input.userId}`);
}

export function signPublisherClaim(input: {
  sourceId: string;
  userId: string;
  privateKey: string;
}): Promise<string> {
  return signBytes(input.privateKey, publisherClaimPayload(input));
}

export function verifyPublisherClaim(input: {
  sourceId: string;
  userId: string;
  publicKey: string;
  signature: string;
}): Promise<boolean> {
  return verifyBytes(input.publicKey, publisherClaimPayload(input), input.signature);
}
