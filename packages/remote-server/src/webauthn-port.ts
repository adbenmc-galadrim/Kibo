type Json = Record<string, unknown>;

export type StoredPasskey = { credentialId: string; publicKey: Uint8Array; counter: number };

export type WebauthnPort = {
  registrationOptions(input: {
    rpId: string;
    userId: string;
    userName: string;
    excludeCredentialIds: string[];
  }): Promise<Json>;
  verifyRegistration(input: {
    response: unknown;
    expectedChallenge: string;
    expectedOrigin: string;
    expectedRpId: string;
  }): Promise<StoredPasskey>;
  authenticationOptions(input: { rpId: string; allowCredentialIds: string[] }): Promise<Json>;
  verifyAuthentication(input: {
    response: unknown;
    expectedChallenge: string;
    expectedOrigin: string;
    expectedRpId: string;
    passkey: StoredPasskey;
  }): Promise<{ credentialId: string; counter: number }>;
};
