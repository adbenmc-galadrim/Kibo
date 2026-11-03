import { KiboError } from "@kibo/schema";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { z } from "zod";

export type StoredPasskey = { credentialId: string; publicKey: Uint8Array; counter: number };

export type WebauthnPort = {
  registrationOptions(input: {
    userId: string;
    userName: string;
    excludeCredentialIds: string[];
  }): Promise<PublicKeyCredentialCreationOptionsJSON>;
  verifyRegistration(input: {
    response: RegistrationResponseJSON;
    expectedChallenge: string;
  }): Promise<StoredPasskey>;
  authenticationOptions(input: {
    allowCredentialIds: string[];
  }): Promise<PublicKeyCredentialRequestOptionsJSON>;
  verifyAuthentication(input: {
    response: AuthenticationResponseJSON;
    expectedChallenge: string;
    passkey: StoredPasskey;
  }): Promise<{ credentialId: string; counter: number }>;
};

const Base64Url = z.string().regex(/^[A-Za-z0-9_-]*$/);

const Transport = z.enum(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]);

const Credential = {
  id: Base64Url.min(1),
  rawId: Base64Url.min(1),
  type: z.literal("public-key"),
  authenticatorAttachment: z.enum(["cross-platform", "platform"]).optional(),
  clientExtensionResults: z.object({
    appid: z.boolean().optional(),
    credProps: z.object({ rk: z.boolean().optional() }).optional(),
    hmacCreateSecret: z.boolean().optional(),
  }),
};

export const RegistrationResponse = z.object({
  ...Credential,
  response: z.object({
    clientDataJSON: Base64Url,
    attestationObject: Base64Url,
    authenticatorData: Base64Url.optional(),
    transports: z.array(Transport).optional(),
    publicKeyAlgorithm: z.number().int().optional(),
    publicKey: Base64Url.optional(),
  }),
}) satisfies z.ZodType<RegistrationResponseJSON>;

export const AuthenticationResponse = z.object({
  ...Credential,
  response: z.object({
    clientDataJSON: Base64Url,
    authenticatorData: Base64Url,
    signature: Base64Url,
    userHandle: Base64Url.optional(),
  }),
}) satisfies z.ZodType<AuthenticationResponseJSON>;

const ClientData = z.object({ challenge: Base64Url.min(1) });

export function challengeOf(response: { response: { clientDataJSON: string } }): string {
  try {
    return ClientData.parse(
      JSON.parse(Buffer.from(response.response.clientDataJSON, "base64url").toString("utf8")),
    ).challenge;
  } catch {
    throw new KiboError("INVALID_INPUT", "clientDataJSON has no challenge");
  }
}
