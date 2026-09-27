import { isKiboErrorCode, type JoinRequest, JoinResponse, KiboError } from "@kibo/schema";
import { z } from "zod";
import type { SecretStore } from "../integrations/types";
import { clearDeviceKeys, createDeviceKeys } from "./device-keys";
import type { SyncDb } from "./sync-db";
import { assertSyncUrl } from "./transport";

export type ConnectInput = { serverUrl: string; code: string; deviceName: string; caFile: string | null };
type ConfigureDeps = {
  db: SyncDb;
  secrets: SecretStore;
  fetchImpl: typeof fetch;
  readFile(path: string): Promise<string>;
};

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

export async function configureServer(deps: ConfigureDeps, input: ConnectInput): Promise<void> {
  const url = assertSyncUrl(input.serverUrl);
  if (deps.db.config()) throw new KiboError("INVALID_INPUT", "a sync server is already configured");
  const serverUrl = url.toString().replace(/\/$/, "");
  const ca = input.caFile ? await deps.readFile(input.caFile) : null;
  const keys = await createDeviceKeys(deps.secrets);
  const request = { code: input.code, publicKey: keys.publicKey, deviceName: input.deviceName };
  const joined = await joinServer(deps.fetchImpl, { serverUrl, ca, request }).catch(async (e: unknown) => {
    await clearDeviceKeys(deps.secrets);
    throw e;
  });
  deps.db.setConfig({
    serverUrl,
    caFile: input.caFile,
    userId: joined.userId,
    deviceId: joined.deviceId,
    displayName: joined.name,
  });
}
