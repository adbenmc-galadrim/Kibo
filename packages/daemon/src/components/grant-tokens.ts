import { randomBytes } from "node:crypto";
import { ASSET_URL_TTL_MS } from "@kibo/schema";

export type GrantTokens<G> = {
  mint(instanceId: string, grant: G): { token: string; expiresAt: number };
  lookup(token: string): G | null;
};
export type GrantTokensOptions = {
  now?: () => number;
  ttlMs?: number;
  perInstance?: number;
  random?: () => string;
};

type Entry<G> = { grant: G; expiresAt: number; instanceId: string };

const TOKENS_PER_INSTANCE = 64;
const randomToken = () => randomBytes(32).toString("hex");

export function createGrantTokens<G>(opts: GrantTokensOptions = {}): GrantTokens<G> {
  const now = opts.now ?? Date.now;
  const ttlMs = opts.ttlMs ?? ASSET_URL_TTL_MS;
  const perInstance = opts.perInstance ?? TOKENS_PER_INSTANCE;
  const random = opts.random ?? randomToken;
  const byToken = new Map<string, Entry<G>>();
  const byInstance = new Map<string, string[]>();

  const drop = (token: string) => {
    const entry = byToken.get(token);
    if (!entry) return;
    byToken.delete(token);
    const left = (byInstance.get(entry.instanceId) ?? []).filter((t) => t !== token);
    if (left.length === 0) byInstance.delete(entry.instanceId);
    else byInstance.set(entry.instanceId, left);
  };
  const expired = (entry: Entry<G>) => now() >= entry.expiresAt;
  const sweep = () => {
    for (const [token, entry] of byToken) if (expired(entry)) drop(token);
  };

  return {
    mint(instanceId, grant) {
      sweep();
      const token = random();
      const expiresAt = now() + ttlMs;
      drop(token);
      byToken.set(token, { grant: structuredClone(grant), expiresAt, instanceId });
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
      return structuredClone(entry.grant);
    },
  };
}
