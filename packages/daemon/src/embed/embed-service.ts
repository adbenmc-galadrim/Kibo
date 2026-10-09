import {
  EMBED_ATTRIBUTES,
  EMBED_TOKENS_PER_INSTANCE,
  EMBED_TOKENS_SHELL,
  EMBED_TTL_MS,
  KiboError,
} from "@kibo/schema";
import { createGrantTokens } from "../components/grant-tokens";
import { SHELL_INSTANCE } from "../design/frame-service";
import { transportUrl } from "../integrations/net";
import { relayAncestors, relayHeaders, relayHtml } from "./relay";
import type { EmbedGrant, EmbedService } from "./types";

export type EmbedServiceDeps = {
  now(): number;
  sandboxOrigin(): string | null;
  uiOrigins(): string[];
  devOrigins: readonly string[];
  aliases: Map<string, URL>;
};

export function createEmbedService(deps: EmbedServiceDeps): EmbedService {
  const tokens = (perInstance: number) =>
    createGrantTokens<EmbedGrant>({ now: deps.now, ttlMs: EMBED_TTL_MS, perInstance });
  const widgetTokens = tokens(EMBED_TOKENS_PER_INSTANCE);
  const shellTokens = tokens(EMBED_TOKENS_SHELL);
  return {
    open(instanceId, kind, target, title) {
      const origin = deps.sandboxOrigin();
      if (origin === null) throw new KiboError("INTERNAL", "sandbox server not started");
      const store = instanceId === SHELL_INSTANCE ? shellTokens : widgetTokens;
      const { token, expiresAt } = store.mint(instanceId, { target, kind, title });
      return { url: `${origin}/e/${token}`, kind, ...EMBED_ATTRIBUTES[kind], expiresAt, target };
    },
    relay(token) {
      const grant = widgetTokens.lookup(token) ?? shellTokens.lookup(token);
      if (grant === null) return null;
      const framed = transportUrl(new URL(grant.target), deps.aliases).target;
      return {
        html: relayHtml({ target: framed.href, kind: grant.kind, title: grant.title }),
        headers: relayHeaders({
          targetOrigin: framed.origin,
          ancestors: relayAncestors(deps.uiOrigins(), deps.devOrigins),
          kind: grant.kind,
        }),
      };
    },
  };
}
