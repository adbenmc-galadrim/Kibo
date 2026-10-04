import { randomBytes } from "node:crypto";
import { ASSET_URL_TTL_MS, type ProjectAssetMime } from "@kibo/schema";

export type FileGrant = { projectId: string; name: string; mime: ProjectAssetMime };
export type FileTokens = {
  mint(instanceId: string, grant: FileGrant): { token: string; expiresAt: number };
  lookup(token: string): FileGrant | null;
};
export type FileTokensOptions = {
  now?: () => number;
  ttlMs?: number;
  perInstance?: number;
  random?: () => string;
};

type Entry = { grant: FileGrant; expiresAt: number; instanceId: string };

const TOKENS_PER_INSTANCE = 64;
const randomToken = () => randomBytes(32).toString("hex");

export function createFileTokens(opts: FileTokensOptions = {}): FileTokens {
  const now = opts.now ?? Date.now;
  const ttlMs = opts.ttlMs ?? ASSET_URL_TTL_MS;
  const perInstance = opts.perInstance ?? TOKENS_PER_INSTANCE;
  const random = opts.random ?? randomToken;
  const byToken = new Map<string, Entry>();
  const byInstance = new Map<string, string[]>();

  const drop = (token: string) => {
    const entry = byToken.get(token);
    if (!entry) return;
    byToken.delete(token);
    const left = (byInstance.get(entry.instanceId) ?? []).filter((t) => t !== token);
    if (left.length === 0) byInstance.delete(entry.instanceId);
    else byInstance.set(entry.instanceId, left);
  };
  const expired = (entry: Entry) => now() >= entry.expiresAt;
  const sweep = () => {
    for (const [token, entry] of byToken) if (expired(entry)) drop(token);
  };

  return {
    mint(instanceId, grant) {
      sweep();
      const token = random();
      const expiresAt = now() + ttlMs;
      drop(token);
      byToken.set(token, { grant: { ...grant }, expiresAt, instanceId });
      const list = [...(byInstance.get(instanceId) ?? []), token];
      byInstance.set(instanceId, list);
      for (const oldest of list.slice(0, Math.max(0, list.length - perInstance))) drop(oldest);
      return { token, expiresAt };
    },
    lookup(token) {
      const entry = byToken.get(token);
      if (!entry) return null;
      if (expired(entry)) {
        drop(token);
        return null;
      }
      return { ...entry.grant };
    },
  };
}
