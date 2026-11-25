import { describe, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { KiboError } from "@kibo/schema";
import { fakeAssertion, fakeRegistration } from "./testing/fake-webauthn";
import { createWebauthn } from "./webauthn";

const RP = { rpId: "kibo.shinseo.fr", origin: "https://kibo.shinseo.fr" };
const webauthn = createWebauthn(RP);
const passkey = { credentialId: "cred-1", publicKey: new Uint8Array([1, 2, 3]), counter: 0 };
const USER_PRESENT = 0x01;
const FIXED_MESSAGE = "passkey verification failed";

function authData(flags: number): Uint8Array {
  const rpIdHash = createHash("sha256").update(RP.rpId).digest();
  return new Uint8Array([...rpIdHash, flags, 0, 0, 0, 1]);
}

const cborText = (text: string) => [0x60 + text.length, ...new TextEncoder().encode(text)];

function noneAttestation(data: Uint8Array): string {
  const map = [
    0xa3,
    ...cborText("fmt"),
    ...cborText("none"),
    ...cborText("attStmt"),
    0xa0,
    ...cborText("authData"),
    0x58,
    data.length,
    ...data,
  ];
  return Buffer.from(new Uint8Array(map)).toString("base64url");
}

async function refusal(work: () => Promise<unknown>) {
  const spy = spyOn(console, "error").mockImplementation(() => {});
  const error = await work().then(
    () => null,
    (e: unknown) => e,
  );
  const logged = spy.mock.calls.flat().map(String).join(" ");
  spy.mockRestore();
  expect(error).toBeInstanceOf(KiboError);
  expect(error instanceof KiboError ? [error.code, error.detail] : []).toEqual([
    "UNAUTHORIZED",
    FIXED_MESSAGE,
  ]);
  return logged;
}

describe("webauthn adapter", () => {
  test("registration options name the relying party, require a resident key and user verification", async () => {
    const options = await webauthn.registrationOptions({
      userId: "account-1",
      userName: "kibo",
      excludeCredentialIds: ["cred-1"],
    });
    expect(options.rp).toEqual({ name: "Kibo", id: RP.rpId });
    expect(options.authenticatorSelection).toMatchObject({
      residentKey: "required",
      userVerification: "required",
    });
    expect(options.excludeCredentials?.map((c) => c.id)).toEqual(["cred-1"]);
    expect(options.attestation).toBe("none");
    expect(options.challenge.length).toBeGreaterThan(20);
  });

  test("authentication options use the relying party id, resident keys and user verification", async () => {
    const options = await webauthn.authenticationOptions();
    expect(options.rpId).toBe(RP.rpId);
    expect(options.userVerification).toBe("required");
    expect(options.allowCredentials ?? []).toEqual([]);
  });

  test("a registration from another origin is refused with a fixed message, the reason only logged", async () => {
    const response = fakeRegistration("challenge-1", "https://elsewhere.test", "cred-1");
    const logged = await refusal(() =>
      webauthn.verifyRegistration({ response, expectedChallenge: "challenge-1" }),
    );
    expect(logged).toContain("origin");
  });

  test("an assertion from another origin is refused with a fixed message, the reason only logged", async () => {
    const response = fakeAssertion("challenge-1", "https://elsewhere.test", 1, "cred-1");
    const logged = await refusal(() =>
      webauthn.verifyAuthentication({ response, expectedChallenge: "challenge-1", passkey }),
    );
    expect(logged).toContain("origin");
  });

  test("a registration without user verification is refused", async () => {
    const response = fakeRegistration("challenge-1", RP.origin, "cred-1");
    response.response.attestationObject = noneAttestation(authData(USER_PRESENT));
    const logged = await refusal(() =>
      webauthn.verifyRegistration({ response, expectedChallenge: "challenge-1" }),
    );
    expect(logged).toContain("User verification was required");
  });

  test("an assertion without user verification is refused", async () => {
    const response = fakeAssertion("challenge-1", RP.origin, 1, "cred-1");
    response.response.authenticatorData = Buffer.from(authData(USER_PRESENT)).toString("base64url");
    const logged = await refusal(() =>
      webauthn.verifyAuthentication({ response, expectedChallenge: "challenge-1", passkey }),
    );
    expect(logged).toContain("User verification required");
  });
});
