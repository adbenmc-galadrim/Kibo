import type { CodeRequest, RpcRequest } from "@kibo/schema";
import { createClient, type KiboClient } from "@kibo/sdk";
import { isCodeWrite, isProjectWrite, projectIdOf } from "./tabs/write-requests";

const unauthorizedListeners = new Set<() => void>();
const writeListeners = new Set<(projectId: string | null) => void>();
const writeDoneListeners = new Set<(projectId: string | null) => void>();
const rpcListeners = new Set<(method: string) => void>();

const raw = createClient({
  baseUrl: "",
  onUnauthorized: () => {
    for (const l of unauthorizedListeners) l();
  },
});

const announce = (req: RpcRequest | CodeRequest) => {
  const projectId = projectIdOf(req);
  for (const l of writeListeners) l(projectId);
};

const announceDone = (req: RpcRequest) => {
  const projectId = projectIdOf(req);
  for (const l of writeDoneListeners) l(projectId);
};

export const client: KiboClient = {
  ...raw,
  rpc: (req) => {
    for (const l of rpcListeners) l(req.method);
    if (!isProjectWrite(req)) return raw.rpc(req);
    announce(req);
    return raw.rpc(req).finally(() => announceDone(req));
  },
  code: (req) => {
    if (isCodeWrite(req)) announce(req);
    return raw.code(req);
  },
};

export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function onWrite(listener: (projectId: string | null) => void): () => void {
  writeListeners.add(listener);
  return () => writeListeners.delete(listener);
}

export function onWriteDone(listener: (projectId: string | null) => void): () => void {
  writeDoneListeners.add(listener);
  return () => writeDoneListeners.delete(listener);
}

export function onRpc(listener: (method: string) => void): () => void {
  rpcListeners.add(listener);
  return () => rpcListeners.delete(listener);
}
