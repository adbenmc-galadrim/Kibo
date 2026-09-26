import { SESSION_TTL_MS } from "./session-store";

export const SESSION_COOKIE = "kibo_session";

export function sessionCookie(id: string, secure: boolean): string {
  const base = `${SESSION_COOKIE}=${id}; Max-Age=${SESSION_TTL_MS / 1000}; HttpOnly; SameSite=Strict; Path=/`;
  return secure ? `${base}; Secure` : base;
}
