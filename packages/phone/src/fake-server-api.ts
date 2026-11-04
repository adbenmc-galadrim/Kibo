import { openRequest, type RemoteKeys, type Sealed, type SealedRequest, sealRequest } from "@kibo/remote";
import { KiboError, type RpcResponse } from "@kibo/schema";
import type { ServerApi } from "./server-api";

type Reply = (req: unknown) => RpcResponse | Promise<RpcResponse>;

export type FakeServerApi = ServerApi & {
  calls: string[];
  blobs: Map<string, Sealed>;
  requests: unknown[];
  reply: Reply;
  status: number | null;
};

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export function fakeServerApi(keys: RemoteKeys): FakeServerApi {
  const api: FakeServerApi = {
    calls: [],
    blobs: new Map(),
    requests: [],
    status: null,
    reply: () => ({ ok: true, result: null }),
    session: async () => true,
    pairOptions: async () => {
      throw new KiboError("FORBIDDEN", "not in this fake");
    },
    pairVerify: async () => undefined,
    loginOptions: async () => {
      throw new KiboError("FORBIDDEN", "not in this fake");
    },
    loginVerify: async () => undefined,
    logout: async () => undefined,
    snapshotHeaders: async (projectId) => {
      api.calls.push(`headers ${projectId}`);
      return [...api.blobs.values()].filter((s) => s.header.projectId === projectId).map((s) => s.header);
    },
    snapshot: async (projectId, kind) => {
      api.calls.push(`snapshot ${projectId} ${kind}`);
      return api.blobs.get(`${projectId}/${kind}`) ?? null;
    },
    request: async (sealed: SealedRequest) => {
      api.calls.push("request");
      if (api.status === 503) throw new KiboError("REMOTE_UNAVAILABLE", "mac is not connected");
      const req: unknown = JSON.parse(decoder.decode(await openRequest(keys, sealed)));
      api.requests.push(req);
      const answer = encoder.encode(JSON.stringify(await api.reply(req)));
      return sealRequest(keys, sealed.header, answer);
    },
    eventsUrl: () => "ws://127.0.0.1/api/phone/events",
  };
  return api;
}

export const putBlob = (api: FakeServerApi, sealed: Sealed) =>
  api.blobs.set(`${sealed.header.projectId}/${sealed.header.kind}`, sealed);
