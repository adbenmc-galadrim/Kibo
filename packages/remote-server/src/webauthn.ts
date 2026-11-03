import { KiboError } from "@kibo/schema";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { WebauthnPort } from "./webauthn-port";

const RP_NAME = "Kibo";
const USER_VERIFICATION = "required";
const FAILED = "passkey verification failed";

type RelyingParty = { rpId: string; origin: string };

const refused = (reason: unknown): never => {
  console.error(`[kibo-remote] ${FAILED}`, reason);
  throw new KiboError("UNAUTHORIZED", FAILED);
};

async function verified<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (e) {
    return refused(e);
  }
}

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
          requireUserVerification: true,
        }),
      );
      if (!result.verified) return refused("registration not verified");
      const { id, publicKey, counter } = result.registrationInfo.credential;
      return { credentialId: id, publicKey, counter };
    },
    authenticationOptions: () =>
      generateAuthenticationOptions({
        rpID: rpId,
        allowCredentials: [],
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
          requireUserVerification: true,
        }),
      );
      if (!result.verified) return refused("assertion not verified");
      return {
        credentialId: result.authenticationInfo.credentialID,
        counter: result.authenticationInfo.newCounter,
      };
    },
  };
}
