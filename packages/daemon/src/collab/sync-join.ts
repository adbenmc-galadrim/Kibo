import { isKiboErrorCode, type JoinRequest, JoinResponse, KiboError } from "@kibo/schema";
import { z } from "zod";

const JoinReply = z.union([
  z.object({ ok: z.literal(true), result: JoinResponse }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),
]);

export function httpBaseOf(serverUrl: string): string {
  return serverUrl.replace(/^ws(s?):/, "http$1:");
}

export async function joinServer(
  fetchImpl: typeof fetch,
  input: { serverUrl: string; ca: string | null; request: JoinRequest },
): Promise<JoinResponse> {
  let res: Response;
  try {
    res = await fetchImpl(`${httpBaseOf(input.serverUrl)}/v1/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input.request),
      ...(input.ca ? { tls: { ca: input.ca } } : {}),
    });
  } catch (e) {
    throw new KiboError("SYNC_OFFLINE", `sync server unreachable: ${String(e)}`);
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch (e) {
    throw new KiboError(
      "SYNC_OFFLINE",
      `sync server sent an unreadable join reply (${res.status}): ${String(e)}`,
    );
  }
  const reply = JoinReply.safeParse(json);
  if (!reply.success) throw new KiboError("SYNC_OFFLINE", `unexpected join reply (${res.status})`);
  if (reply.data.ok) return reply.data.result;
  const { code, message } = reply.data.error;
  throw new KiboError(isKiboErrorCode(code) ? code : "INVITE_INVALID", message);
}
