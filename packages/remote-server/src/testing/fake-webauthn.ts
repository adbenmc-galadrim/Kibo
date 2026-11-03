import { KiboError } from "@kibo/schema";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import type { WebauthnPort } from "../webauthn-port";

export const FAKE_CREDENTIAL_ID = "fake-cred";

const RP_ID_HASH_BYTES = 32;
const FLAGS_BYTES = 1;
const COUNTER_OFFSET = RP_ID_HASH_BYTES + FLAGS_BYTES;

const base64url = (bytes: Uint8Array | string) => Buffer.from(bytes).toString("base64url");

const clientData = (type: string, challenge: string, origin: string) =>
  base64url(JSON.stringify({ type, challenge, origin }));

function authenticatorData(counter: number): string {
  const data = new Uint8Array(COUNTER_OFFSET + 4);
  new DataView(data.buffer).setUint32(COUNTER_OFFSET, counter);
  return base64url(data);
}

const counterOf = (data: string) =>
  new DataView(new Uint8Array(Buffer.from(data, "base64url")).buffer).getUint32(COUNTER_OFFSET);

const refuse = (): never => {
  throw new KiboError("UNAUTHORIZED", "passkey verification failed");
};

export const fakeRegistration = (
  challenge: string,
  origin: string,
  id: string = FAKE_CREDENTIAL_ID,
): RegistrationResponseJSON => ({
  id,
  rawId: id,
  type: "public-key",
  clientExtensionResults: {},
  response: {
    clientDataJSON: clientData("webauthn.create", challenge, origin),
    attestationObject: base64url("attestation"),
  },
});

export const fakeAssertion = (
  challenge: string,
  origin: string,
  counter: number,
  id: string = FAKE_CREDENTIAL_ID,
): AuthenticationResponseJSON => ({
  id,
  rawId: id,
  type: "public-key",
  clientExtensionResults: {},
  response: {
    clientDataJSON: clientData("webauthn.get", challenge, origin),
    authenticatorData: authenticatorData(counter),
    signature: base64url("signature"),
  },
});

const challenge = () => base64url(crypto.getRandomValues(new Uint8Array(32)));

export const fakeWebauthn = (): WebauthnPort => ({
  registrationOptions: async ({ userId, userName, excludeCredentialIds }) => ({
    challenge: challenge(),
    rp: { name: "Kibo", id: "127.0.0.1" },
    user: { id: base64url(userId), name: userName, displayName: userName },
    pubKeyCredParams: [{ alg: -7, type: "public-key" }],
    excludeCredentials: excludeCredentialIds.map((id) => ({ id, type: "public-key" })),
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  }),
  verifyRegistration: async ({ response }) =>
    response.id === FAKE_CREDENTIAL_ID
      ? { credentialId: response.id, publicKey: new Uint8Array([1, 2, 3]), counter: 0 }
      : refuse(),
  authenticationOptions: async ({ allowCredentialIds }) => ({
    challenge: challenge(),
    rpId: "127.0.0.1",
    allowCredentials: allowCredentialIds.map((id) => ({ id, type: "public-key" })),
    userVerification: "preferred",
  }),
  verifyAuthentication: async ({ response, passkey }) =>
    response.id === FAKE_CREDENTIAL_ID && passkey.credentialId === response.id
      ? { credentialId: response.id, counter: counterOf(response.response.authenticatorData) }
      : refuse(),
});
