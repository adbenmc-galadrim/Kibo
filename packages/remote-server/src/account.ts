import type { Database } from "bun:sqlite";
import { KiboError } from "@kibo/schema";
import { z } from "zod";
import { sameBytes, sameSecret, sha256 } from "./hashing";
import { AUTH_POLICY, createRateLimit } from "./rate-limit";

const MAC_TOKEN_MIN_LENGTH = 16;
const SETUP_CODE_MIN_LENGTH = 20;

export function assertSetupCode(setupCode: string): void {
  if (setupCode.length < SETUP_CODE_MIN_LENGTH)
    throw new KiboError("INVALID_INPUT", `the setup code needs at least ${SETUP_CODE_MIN_LENGTH} characters`);
}

const RegisterBody = z.object({ setupCode: z.string(), macToken: z.string() });

type Account = {
  register(body: unknown): { accountId: string };
  authenticateMac(token: string | null): void;
};

export function createAccount(db: Database, setupCode: string, now: () => number): Account {
  const registerLimit = createRateLimit(db, "register", AUTH_POLICY, now);
  const macLimit = createRateLimit(db, "mac-token", AUTH_POLICY, now);
  const current = db.query<{ account_id: string; mac_token_hash: Uint8Array }, []>(
    "SELECT account_id, mac_token_hash FROM account WHERE id = 1",
  );
  return {
    register: (body) => {
      const parsed = RegisterBody.safeParse(body);
      if (!parsed.success) throw new KiboError("INVALID_INPUT", "register needs setupCode and macToken");
      if (registerLimit.blocked()) throw new KiboError("RATE_LIMITED", "too many failed registrations");
      if (!sameSecret(parsed.data.setupCode, setupCode)) {
        registerLimit.fail();
        throw new KiboError("FORBIDDEN", "wrong setup code");
      }
      registerLimit.succeed();
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
    authenticateMac: (token) => {
      if (macLimit.blocked()) throw new KiboError("RATE_LIMITED", "too many failed mac authentications");
      const row = current.get();
      if (row && token && sameBytes(sha256(token), new Uint8Array(row.mac_token_hash)))
        return macLimit.succeed();
      macLimit.fail();
      throw new KiboError("UNAUTHORIZED", "mac token required");
    },
  };
}

export function bearerOf(req: Request): string | null {
  const match = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
}
