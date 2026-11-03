import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { fakeAssertion, fakeRegistration } from "./testing/fake-webauthn";
import { createWebauthn } from "./webauthn";

const RP = { rpId: "kibo.shinseo.fr", origin: "https://kibo.shinseo.fr" };
const webauthn = createWebauthn(RP);
const passkey = { credentialId: "cred-1", publicKey: new Uint8Array([1, 2, 3]), counter: 0 };

const refusal = async (work: Promise<unknown>) => {
  const error = await work.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(KiboError);
  return error instanceof KiboError ? error : null;
};

describe("webauthn adapter", () => {
  test("registration options name the relying party and require a resident key", async () => {
    const options = await webauthn.registrationOptions({
      userId: "account-1",
      userName: "kibo",
      excludeCredentialIds: ["cred-1"],
    });
    expect(options.rp).toEqual({ name: "Kibo", id: RP.rpId });
    expect(options.authenticatorSelection).toMatchObject({
      residentKey: "required",
      userVerification: "preferred",
    });
    expect(options.excludeCredentials?.map((c) => c.id)).toEqual(["cred-1"]);
    expect(options.attestation).toBe("none");
    expect(options.challenge.length).toBeGreaterThan(20);
  });

  test("authentication options use the relying party id and prefer user verification", async () => {
    const options = await webauthn.authenticationOptions({ allowCredentialIds: ["cred-1"] });
    expect(options.rpId).toBe(RP.rpId);
    expect(options.userVerification).toBe("preferred");
    expect(options.allowCredentials?.map((c) => c.id)).toEqual(["cred-1"]);
  });

  test("a registration from another origin is refused as UNAUTHORIZED", async () => {
    const response = fakeRegistration("challenge-1", "https://elsewhere.test", "cred-1");
    const error = await refusal(webauthn.verifyRegistration({ response, expectedChallenge: "challenge-1" }));
    expect(error?.code).toBe("UNAUTHORIZED");
    expect(error?.detail).toContain("origin");
  });

  test("an assertion from another origin is refused as UNAUTHORIZED", async () => {
    const response = fakeAssertion("challenge-1", "https://elsewhere.test", 1, "cred-1");
    const error = await refusal(
      webauthn.verifyAuthentication({ response, expectedChallenge: "challenge-1", passkey }),
    );
    expect(error?.code).toBe("UNAUTHORIZED");
    expect(error?.detail).toContain("origin");
  });

  test("a forged attestation from the right origin is still refused", async () => {
    const response = fakeRegistration("challenge-1", RP.origin, "cred-1");
    const error = await refusal(webauthn.verifyRegistration({ response, expectedChallenge: "challenge-1" }));
    expect(error?.code).toBe("UNAUTHORIZED");
    expect(error?.detail).not.toContain("origin");
  });
});
