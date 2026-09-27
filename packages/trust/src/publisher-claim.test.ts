import { expect, test } from "bun:test";
import { generateKeyPair } from "./ed25519";
import {
  PUBLISHER_CLAIM_HEADER,
  publisherClaimPayload,
  signPublisherClaim,
  verifyPublisherClaim,
} from "./publisher-claim";

test("the claim payload binds the source and the user", () => {
  expect(new TextDecoder().decode(publisherClaimPayload({ sourceId: "equipe", userId: "u1" }))).toBe(
    "kibo-publisher-claim-v1\nequipe\nu1",
  );
  expect(PUBLISHER_CLAIM_HEADER).toBe("x-kibo-publisher-claim");
});

test("control characters are refused in the claim payload", () => {
  expect(() => publisherClaimPayload({ sourceId: "equipe\nx", userId: "u1" })).toThrow("INVALID_INPUT");
  expect(() => publisherClaimPayload({ sourceId: "equipe", userId: "u1\n" })).toThrow("INVALID_INPUT");
});

test("a claim verifies only for its key, source and user", async () => {
  const keys = await generateKeyPair();
  const other = await generateKeyPair();
  const claim = { sourceId: "equipe", userId: "u1" };
  const signature = await signPublisherClaim({ ...claim, privateKey: keys.privateKey });
  expect(await verifyPublisherClaim({ ...claim, publicKey: keys.publicKey, signature })).toBe(true);
  expect(await verifyPublisherClaim({ ...claim, publicKey: other.publicKey, signature })).toBe(false);
  expect(await verifyPublisherClaim({ ...claim, userId: "u2", publicKey: keys.publicKey, signature })).toBe(
    false,
  );
  expect(
    await verifyPublisherClaim({ ...claim, sourceId: "autre", publicKey: keys.publicKey, signature }),
  ).toBe(false);
  expect(await verifyPublisherClaim({ ...claim, publicKey: keys.publicKey, signature: "!!" })).toBe(false);
});
