import type { CodeRequest, RpcRequest } from "@kibo/schema";
import { createClient, type KiboClient } from "@kibo/sdk";
import { isCodeWrite, isProjectWrite, projectIdOf } from "./tabs/write-requests";

const unauthorizedListeners = new Set<() => void>();
const writeListeners = new Set<(projectId: string | null) => void>();

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

export const client: KiboClient = {
  ...raw,
  rpc: (req) => {
    if (isProjectWrite(req)) announce(req);
    return raw.rpc(req);
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
