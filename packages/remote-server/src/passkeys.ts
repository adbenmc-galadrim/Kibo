import type { Database } from "bun:sqlite";
import { KiboError } from "@kibo/schema";
import type { StoredPasskey } from "./webauthn-port";

export type Passkeys = {
  ids(): string[];
  find(credentialId: string): StoredPasskey | null;
  add(passkey: StoredPasskey): void;
  use(credentialId: string, counter: number): void;
};

type Row = { credential_id: string; public_key: Uint8Array; counter: number };

const isReplay = (stored: number, next: number) => (stored > 0 || next > 0) && next <= stored;

export function createPasskeys(db: Database, now: () => number): Passkeys {
  const find = (credentialId: string): StoredPasskey | null => {
    const row = db
      .query<Row, [string]>("SELECT credential_id, public_key, counter FROM passkeys WHERE credential_id = ?")
      .get(credentialId);
    return row
      ? { credentialId: row.credential_id, publicKey: new Uint8Array(row.public_key), counter: row.counter }
      : null;
  };
  return {
    ids: () =>
      db
        .query<{ credential_id: string }, []>("SELECT credential_id FROM passkeys ORDER BY created_at")
        .all()
        .map((row) => row.credential_id),
    find,
    add: ({ credentialId, publicKey, counter }) => {
      db.run(
        "INSERT OR REPLACE INTO passkeys (credential_id, public_key, counter, created_at) VALUES (?, ?, ?, ?)",
        [credentialId, publicKey, counter, now()],
      );
    },
    use: (credentialId, counter) => {
      const stored = find(credentialId);
      if (!stored || isReplay(stored.counter, counter))
        throw new KiboError("UNAUTHORIZED", "passkey counter did not increase");
      db.run("UPDATE passkeys SET counter = ?, last_used_at = ? WHERE credential_id = ?", [
        counter,
        now(),
        credentialId,
      ]);
    },
  };
}
