import type { Database } from "bun:sqlite";
import { randomToken, sha256 } from "./hashing";

const PHONE_COOKIE = "kibo_phone";
const SESSION_TTL_MS = 90 * 24 * 3_600_000;
const RENEW_AFTER_MS = 24 * 3_600_000;
const SESSION_TOKEN_BYTES = 32;
const COOKIE_ATTRIBUTES = "Path=/; HttpOnly; Secure; SameSite=Strict";

type PhoneSession = { token: string; createdAt: number; renewedAt: number; expiresAt: number };

export const sessionCookie = (token: string) =>
  `${PHONE_COOKIE}=${token}; ${COOKIE_ATTRIBUTES}; Max-Age=${SESSION_TTL_MS / 1_000}`;

export const clearedCookie = () => `${PHONE_COOKIE}=; ${COOKIE_ATTRIBUTES}; Max-Age=0`;

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
  return row
    ? { token, createdAt: row.created_at, renewedAt: row.renewed_at, expiresAt: row.expires_at }
    : null;
}

export function renewSession(db: Database, session: PhoneSession, now: number): PhoneSession | null {
  if (now - session.renewedAt < RENEW_AFTER_MS) return null;
  const expiresAt = now + SESSION_TTL_MS;
  db.run("UPDATE phone_sessions SET renewed_at = ?, expires_at = ? WHERE token_hash = ?", [
    now,
    expiresAt,
    sha256(session.token),
  ]);
  return { ...session, renewedAt: now, expiresAt };
}

export function endSession(db: Database, req: Request): void {
  const token = cookieValue(req, PHONE_COOKIE);
  if (token) db.run("DELETE FROM phone_sessions WHERE token_hash = ?", [sha256(token)]);
}

export function revokePhone(db: Database): void {
  db.transaction(() => {
    for (const table of ["phone_sessions", "passkeys", "webauthn_challenges", "pair_tokens", "snapshots"])
      db.run(`DELETE FROM ${table}`);
  })();
}
