import { KiboError } from "@kibo/schema";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { WebauthnPort } from "./webauthn-port";

const RP_NAME = "Kibo";
const USER_VERIFICATION = "preferred";

type RelyingParty = { rpId: string; origin: string };

async function verified<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (e) {
    throw new KiboError("UNAUTHORIZED", `passkey verification failed: ${e instanceof Error ? e.message : e}`);
  }
}

const refused = (): never => {
  throw new KiboError("UNAUTHORIZED", "passkey verification failed");
};

export function createWebauthn({ rpId, origin }: RelyingParty): WebauthnPort {
  return {
    registrationOptions: ({ userId, userName, excludeCredentialIds }) =>
      generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: rpId,
        userID: new TextEncoder().encode(userId),
        userName,
        attestationType: "none",
        excludeCredentials: excludeCredentialIds.map((id) => ({ id })),
        authenticatorSelection: { residentKey: "required", userVerification: USER_VERIFICATION },
      }),
    verifyRegistration: async ({ response, expectedChallenge }) => {
      const result = await verified(() =>
        verifyRegistrationResponse({
          response,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpId,
          requireUserVerification: false,
        }),
      );
      if (!result.verified) return refused();
      const { id, publicKey, counter } = result.registrationInfo.credential;
      return { credentialId: id, publicKey, counter };
    },
    authenticationOptions: ({ allowCredentialIds }) =>
      generateAuthenticationOptions({
        rpID: rpId,
        allowCredentials: allowCredentialIds.map((id) => ({ id })),
        userVerification: USER_VERIFICATION,
      }),
    verifyAuthentication: async ({ response, expectedChallenge, passkey }) => {
      const result = await verified(() =>
        verifyAuthenticationResponse({
          response,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpId,
          credential: {
            id: passkey.credentialId,
            publicKey: new Uint8Array(passkey.publicKey),
            counter: passkey.counter,
          },
          requireUserVerification: false,
        }),
      );
      if (!result.verified) return refused();
      return {
        credentialId: result.authenticationInfo.credentialID,
        counter: result.authenticationInfo.newCounter,
      };
    },
  };
}
