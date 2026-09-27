import { isKiboErrorCode, KiboError } from "@kibo/schema";
import { PUBLISHER_CLAIM_HEADER, signPublisherClaim, signRequest } from "@kibo/trust";
import { z } from "zod";
import { loadDeviceKeys } from "../collab/device-keys";
import type { SyncConfig } from "../collab/sync-db";
import type { SecretStore } from "../integrations/types";
import type { PublisherKeys } from "./publisher-keys";

export const PUBLISH_PATH = "/v1/market/packages";
const PUBLISH_TIMEOUT_MS = 60_000;

const Answer = z.union([
  z.object({ ok: z.literal(true), result: z.object({ serial: z.number().int().nonnegative() }) }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),
]);

export type PublishRequestDeps = {
  secrets: SecretStore;
  caPem(): Promise<string | null>;
  now(): number;
  fetchImpl?: typeof fetch;
  log(message: string, error: unknown): void;
};

export function httpOrigin(serverUrl: string): string {
  const url = new URL(serverUrl);
  return `${url.protocol === "wss:" ? "https:" : "http:"}//${url.host}`;
}

async function headersFor(
  deps: PublishRequestDeps,
  input: { config: SyncConfig; sourceId: string; publisher: PublisherKeys; body: Uint8Array },
): Promise<Record<string, string>> {
  const device = await loadDeviceKeys(deps.secrets);
  const signed = await signRequest({
    deviceId: input.config.deviceId,
    privateKey: device.privateKey,
    method: "POST",
    path: PUBLISH_PATH,
    body: input.body,
    now: deps.now(),
  });
  const claim = await signPublisherClaim({
    sourceId: input.sourceId,
    userId: input.config.userId,
    privateKey: input.publisher.privateKey,
  });
  return { ...signed, [PUBLISHER_CLAIM_HEADER]: claim, "content-type": "application/octet-stream" };
}

async function post(
  deps: PublishRequestDeps,
  url: string,
  headers: Record<string, string>,
  body: Uint8Array,
) {
  const ca = await deps.caPem();
  try {
    return await (deps.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
      ...(ca ? { tls: { ca } } : {}),
    });
  } catch (e) {
    deps.log("market: publication request failed", e);
    throw new KiboError("SYNC_OFFLINE", "the sync server is unreachable");
  }
}

async function readAnswer(deps: PublishRequestDeps, res: Response): Promise<z.infer<typeof Answer>> {
  const parsed = Answer.safeParse(await res.json().catch(() => null));
  if (parsed.success) return parsed.data;
  deps.log("market: unexpected publication answer", `HTTP ${res.status}`);
  throw new KiboError("INTERNAL", "unexpected answer from the sync server");
}

export async function sendPackage(
  deps: PublishRequestDeps,
  input: { config: SyncConfig; sourceId: string; publisher: PublisherKeys; body: Uint8Array },
): Promise<number> {
  const headers = await headersFor(deps, input);
  const res = await post(deps, `${httpOrigin(input.config.serverUrl)}${PUBLISH_PATH}`, headers, input.body);
  const answer = await readAnswer(deps, res);
  if (answer.ok) return answer.result.serial;
  const { code, message } = answer.error;
  deps.log("market: the team source refused the publication", `${code}: ${message}`);
  if (!isKiboErrorCode(code) || code === "INTERNAL")
    throw new KiboError("INTERNAL", "the team source failed to publish");
  throw new KiboError(code, `the team source refused the publication (${code})`);
}
