import { decodePairingCode, deriveKeys, INDEX_PROJECT_ID, openSnapshot } from "@kibo/remote";
import { KiboError } from "@kibo/schema";
import {
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import type { KeyStore } from "./key-store";
import type { ServerApi } from "./server-api";
import type { SnapshotStore } from "./snapshot-store";

export type PasskeyPort = {
  create(options: PublicKeyCredentialCreationOptionsJSON): Promise<RegistrationResponseJSON>;
  get(options: PublicKeyCredentialRequestOptionsJSON): Promise<AuthenticationResponseJSON>;
};

export const browserPasskeys: PasskeyPort = {
  create: (optionsJSON) => startRegistration({ optionsJSON }),
  get: (optionsJSON) => startAuthentication({ optionsJSON }),
};

export type PairingDeps = {
  api: ServerApi;
  passkeys: PasskeyPort;
  keyStore: KeyStore;
  snapshots: SnapshotStore;
};

export async function pairPhone(deps: PairingDeps, text: string): Promise<void> {
  const code = decodePairingCode(text);
  const pairing = { accountId: code.accountId, pairToken: code.pairToken };
  const response = await deps.passkeys.create(await deps.api.pairOptions(pairing));
  await deps.api.pairVerify({ ...pairing, response });
  const index = await deps.api.snapshot(INDEX_PROJECT_ID, "projects");
  if (!index) throw new KiboError("REMOTE_NOT_FOUND", "the mac has not sent its project index yet");
  const epoch = index.header.keyEpoch;
  await openSnapshot(await deriveKeys(code.rootKey, code.accountId, epoch), index);
  await deps.snapshots.clear();
  await deps.keyStore.save(code.accountId, code.rootKey, epoch);
  await deps.snapshots.put(index);
}

export async function signIn(deps: Pick<PairingDeps, "api" | "passkeys">): Promise<void> {
  const response = await deps.passkeys.get(await deps.api.loginOptions());
  await deps.api.loginVerify(response);
}

export const isCancelled = (e: unknown): boolean =>
  e instanceof Error &&
  (e.name === "NotAllowedError" || e.name === "AbortError" || e.message.includes("ERROR_CEREMONY_ABORTED"));
