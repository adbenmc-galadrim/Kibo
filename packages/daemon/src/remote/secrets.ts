import { KiboError } from "@kibo/schema";
import type { SecretStore } from "../integrations/types";

export type RemoteCredentials = { rootKey: Uint8Array; macToken: string };

export type RemoteSecrets = {
  load(): Promise<RemoteCredentials | null>;
  save(credentials: RemoteCredentials): Promise<void>;
  saveRootKey(rootKey: Uint8Array): Promise<void>;
  macToken(): Promise<string | null>;
  forgetRootKey(): Promise<void>;
  clear(): Promise<void>;
};

const ROOT_KEY = "remote";
const MAC_TOKEN = "remote:server";
const MAC_TOKEN_BYTES = 32;
const ROOT_KEY_BYTES = 32;

const toBase64Url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

export const newMacToken = (): string => toBase64Url(crypto.getRandomValues(new Uint8Array(MAC_TOKEN_BYTES)));

function decodeRootKey(text: string): Uint8Array {
  const bytes = new Uint8Array(Buffer.from(text, "base64url"));
  if (bytes.byteLength !== ROOT_KEY_BYTES)
    throw new KiboError("STORE_CORRUPT", "the phone access key in the keychain is damaged");
  return bytes;
}

export function openRemoteSecrets(keychain: SecretStore): RemoteSecrets {
  return {
    load: async () => {
      const [rootKey, macToken] = await Promise.all([keychain.get(ROOT_KEY), keychain.get(MAC_TOKEN)]);
      if (rootKey === null || macToken === null) return null;
      return { rootKey: decodeRootKey(rootKey), macToken };
    },
    save: async ({ rootKey, macToken }) => {
      await keychain.set(ROOT_KEY, toBase64Url(rootKey));
      await keychain.set(MAC_TOKEN, macToken);
    },
    saveRootKey: (rootKey) => keychain.set(ROOT_KEY, toBase64Url(rootKey)),
    macToken: () => keychain.get(MAC_TOKEN),
    forgetRootKey: () => keychain.delete(ROOT_KEY),
    clear: async () => {
      await keychain.delete(ROOT_KEY);
      await keychain.delete(MAC_TOKEN);
    },
  };
}
