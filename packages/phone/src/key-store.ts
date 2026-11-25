import { deriveKeys, type RemoteKeys } from "@kibo/remote";
import { z } from "zod";
import type { KeyValueStore } from "./storage";

export type KeyStore = {
  load(): Promise<{ accountId: string; keys: RemoteKeys } | null>;
  save(accountId: string, root: Uint8Array, epoch: number): Promise<void>;
  clear(): Promise<void>;
};

const RECORD = "current";

const StoredKeys = z.object({
  accountId: z.string().min(1),
  epoch: z.number().int().positive(),
  snapshot: z.instanceof(CryptoKey),
  request: z.instanceof(CryptoKey),
});

export function createKeyStore(store: KeyValueStore): KeyStore {
  return {
    async load() {
      const parsed = StoredKeys.safeParse(await store.get(RECORD));
      if (!parsed.success) return null;
      const { accountId, epoch, snapshot, request } = parsed.data;
      return { accountId, keys: { snapshot, request, epoch } };
    },
    async save(accountId, root, epoch) {
      const { snapshot, request } = await deriveKeys(root, accountId, epoch);
      await store.put(RECORD, { accountId, epoch, snapshot, request });
    },
    clear: () => store.clear(),
  };
}
