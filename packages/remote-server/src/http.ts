import type { KiboErrorCode } from "@kibo/schema";
import { KiboError } from "@kibo/schema";

const STATUS: Partial<Record<KiboErrorCode, number>> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  REMOTE_NOT_FOUND: 404,
  REMOTE_TOO_LARGE: 413,
  TOO_LARGE: 413,
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

const tooLarge = (maxBytes: number) => new KiboError("TOO_LARGE", `body is over ${maxBytes} bytes`);

async function readBounded(req: Request, maxBytes: number): Promise<string> {
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes) throw tooLarge(maxBytes);
  if (!req.body) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of req.body) {
    size += chunk.length;
    if (size > maxBytes) throw tooLarge(maxBytes);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  const text = await readBounded(req, maxBytes);
  try {
    return JSON.parse(text);
  } catch {
    throw new KiboError("INVALID_INPUT", "body is not JSON");
  }
}
