import type { Database } from "bun:sqlite";
import { KiboError } from "@kibo/schema";
import { z } from "zod";
import { sameBytes, sameSecret, sha256 } from "./hashing";

const MAC_TOKEN_MIN_LENGTH = 16;

const RegisterBody = z.object({ setupCode: z.string(), macToken: z.string() });

type Account = {
  register(body: unknown): { accountId: string };
  isMacToken(token: string): boolean;
};

export function createAccount(db: Database, setupCode: string, now: () => number): Account {
  const current = db.query<{ account_id: string; mac_token_hash: Uint8Array }, []>(
    "SELECT account_id, mac_token_hash FROM account WHERE id = 1",
  );
  return {
    register: (body) => {
      const parsed = RegisterBody.safeParse(body);
      if (!parsed.success) throw new KiboError("INVALID_INPUT", "register needs setupCode and macToken");
      if (!sameSecret(parsed.data.setupCode, setupCode)) throw new KiboError("FORBIDDEN", "wrong setup code");
      if (parsed.data.macToken.length < MAC_TOKEN_MIN_LENGTH)
        throw new KiboError("INVALID_INPUT", `macToken needs at least ${MAC_TOKEN_MIN_LENGTH} characters`);
      const accountId = current.get()?.account_id ?? crypto.randomUUID();
      const at = now();
      db.run(
        `INSERT INTO account (id, account_id, mac_token_hash, created_at, updated_at) VALUES (1, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET mac_token_hash = excluded.mac_token_hash, updated_at = excluded.updated_at`,
        [accountId, sha256(parsed.data.macToken), at, at],
      );
      return { accountId };
    },
    isMacToken: (token) => {
      const row = current.get();
      return row !== null && token.length > 0 && sameBytes(sha256(token), new Uint8Array(row.mac_token_hash));
    },
  };
}

export function bearerOf(req: Request): string | null {
  const match = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
}
