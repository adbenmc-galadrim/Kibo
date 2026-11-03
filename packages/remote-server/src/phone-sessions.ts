import type { Database } from "bun:sqlite";
import { randomToken, sha256 } from "./hashing";

const PHONE_COOKIE = "kibo_phone";
const SESSION_TTL_MS = 90 * 24 * 3_600_000;
const SESSION_TOKEN_BYTES = 32;

type PhoneSession = { createdAt: number; renewedAt: number; expiresAt: number };

export function createSession(db: Database, now: number): string {
  const token = randomToken(SESSION_TOKEN_BYTES);
  db.run("INSERT INTO phone_sessions (token_hash, created_at, renewed_at, expires_at) VALUES (?, ?, ?, ?)", [
    sha256(token),
    now,
    now,
    now + SESSION_TTL_MS,
  ]);
  return token;
}

function cookieValue(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export function sessionOf(db: Database, req: Request, now: number): PhoneSession | null {
  const token = cookieValue(req, PHONE_COOKIE);
  if (!token) return null;
  const row = db
    .query<{ created_at: number; renewed_at: number; expires_at: number }, [Uint8Array, number]>(
      "SELECT created_at, renewed_at, expires_at FROM phone_sessions WHERE token_hash = ? AND expires_at > ?",
    )
    .get(sha256(token), now);
  return row ? { createdAt: row.created_at, renewedAt: row.renewed_at, expiresAt: row.expires_at } : null;
}

export function revokePhone(db: Database): void {
  db.transaction(() => {
    for (const table of ["phone_sessions", "passkeys", "webauthn_challenges", "pair_tokens", "snapshots"])
      db.run(`DELETE FROM ${table}`);
  })();
}
