import { deriveKeys, type RemoteKeys, type Sealed, sealSnapshot } from "@kibo/remote";

const encoder = new TextEncoder();

export const ACCOUNT_ID = "acct-silo";

export const rootKey = (fill: number): Uint8Array => new Uint8Array(32).fill(fill);

export const testKeys = (fill = 7, epoch = 1): Promise<RemoteKeys> =>
  deriveKeys(rootKey(fill), ACCOUNT_ID, epoch);

export function sealJson(
  keys: RemoteKeys,
  projectId: string,
  kind: string,
  value: unknown,
  { seq = 1, builtAt = 1_760_619_120_000 }: { seq?: number; builtAt?: number } = {},
): Promise<Sealed> {
  return sealSnapshot(
    keys,
    { v: 1, projectId, kind, seq, builtAt, keyEpoch: keys.epoch },
    encoder.encode(JSON.stringify(value)),
  );
}
