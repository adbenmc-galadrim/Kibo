import type { KiboErrorCode } from "@kibo/schema";
import { KiboError } from "@kibo/schema";

const STATUS: Partial<Record<KiboErrorCode, number>> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  REMOTE_NOT_FOUND: 404,
  REMOTE_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  REMOTE_UNAVAILABLE: 503,
  TIMEOUT: 504,
};

export const fail = (code: KiboErrorCode, message: string): Response =>
  Response.json({ ok: false, error: { code, message } }, { status: STATUS[code] ?? 400 });

export async function handled(work: () => Promise<Response | undefined>): Promise<Response | undefined> {
  try {
    return await work();
  } catch (e) {
    if (e instanceof KiboError) return fail(e.code, e.detail);
    console.error("[kibo-remote] request failed", e);
    return Response.json(
      { ok: false, error: { code: "INTERNAL", message: "internal error" } },
      { status: 500 },
    );
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new KiboError("INVALID_INPUT", "body is not JSON");
  }
}
