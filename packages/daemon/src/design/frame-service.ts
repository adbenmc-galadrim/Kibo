import {
  ASSET_URL_TTL_MS,
  DESIGN_FRESH_MS,
  DESIGN_TOKENS_SHELL,
  type DesignFrame,
  type DesignFrameKey,
  designFrameId,
  frameExtension,
  type ImageDesignProvider,
  KiboError,
} from "@kibo/schema";
import type { ServedFile } from "../components/file-response";
import { createGrantTokens } from "../components/grant-tokens";
import type { EventLog } from "../integrations/events";
import type { CachedFrame, FrameCache } from "./frame-cache";
import { parseFrameUrl } from "./frame-url";
import { type DesignProviderClient, type FrameMeta, UNREACHABLE_CODES } from "./providers/types";

export type FrameService = {
  frame(instanceId: string, url: string, refresh: boolean): Promise<DesignFrame>;
  metadata(key: DesignFrameKey): Promise<FrameMeta>;
  open(token: string): Promise<ServedFile | null>;
};
export type FrameServiceDeps = {
  cache: FrameCache;
  providers: Record<ImageDesignProvider, DesignProviderClient>;
  penpotInstance(): string | null;
  sandboxOrigin(): string | null;
  now(): number;
  events: EventLog;
  freshMs?: number;
};
type Grant = { path: string; mime: CachedFrame["mime"]; size: number };

export const SHELL_INSTANCE = "shell";
const imageKey = (key: DesignFrameKey): Exclude<DesignFrameKey, { provider: "storybook" }> => {
  if (key.provider === "storybook") throw new KiboError("INVALID_INPUT", "storybook frames are not wired");
  return key;
};
const servesStale = (e: unknown) =>
  e instanceof KiboError && (UNREACHABLE_CODES.has(e.code) || e.code === "REMOTE_NOT_RENDERED");

export function createFrameService(deps: FrameServiceDeps): FrameService {
  const fresh = deps.freshMs ?? DESIGN_FRESH_MS;
  const widgetTokens = createGrantTokens<Grant>({ now: deps.now, ttlMs: ASSET_URL_TTL_MS });
  const shellTokens = createGrantTokens<Grant>({
    now: deps.now,
    ttlMs: ASSET_URL_TTL_MS,
    perInstance: DESIGN_TOKENS_SHELL,
  });
  const view = (
    instanceId: string,
    hit: CachedFrame,
    source: string,
    stale: boolean,
    reachable: boolean,
  ): DesignFrame => {
    const origin = deps.sandboxOrigin();
    if (!origin) throw new KiboError("INTERNAL", "sandbox listener not started");
    const tokens = instanceId === SHELL_INSTANCE ? shellTokens : widgetTokens;
    const { token } = tokens.mint(instanceId, { path: hit.path, mime: hit.mime, size: hit.bytes });
    return {
      id: hit.id,
      provider: hit.provider,
      name: hit.name,
      width: hit.width,
      height: hit.height,
      url: `${origin}/d/${token}/frame.${frameExtension(hit.mime)}`,
      mime: hit.mime,
      fetchedAt: hit.fetchedAt,
      stale,
      reachable,
      source,
    };
  };
  const renderInto = async (
    provider: DesignProviderClient,
    key: DesignFrameKey,
    id: string,
  ): Promise<CachedFrame> => {
    const r = await provider.render(key);
    return deps.cache.put({
      id,
      provider: key.provider,
      name: r.meta.name,
      width: r.meta.width,
      height: r.meta.height,
      mime: r.mime,
      version: r.version,
      fetchedAt: deps.now(),
      body: r.body,
    });
  };
  const revalidate = async (
    provider: DesignProviderClient,
    key: DesignFrameKey,
    id: string,
    hit: CachedFrame | null,
  ): Promise<CachedFrame> => {
    if (hit) {
      const version = await provider.version(key);
      if (version !== null && version === hit.version) {
        deps.cache.touch(id, deps.now());
        return { ...hit, fetchedAt: deps.now() };
      }
    }
    return renderInto(provider, key, id);
  };
  return {
    async frame(instanceId, raw, refresh) {
      const parsed = parseFrameUrl(raw, deps.penpotInstance());
      const key = imageKey(parsed.key);
      const url = parsed.url;
      const id = designFrameId(key);
      const hit = deps.cache.get(id);
      if (hit && !refresh && deps.now() - hit.fetchedAt < fresh)
        return view(instanceId, hit, url, false, true);
      const provider = deps.providers[key.provider];
      if (!(await provider.connected())) {
        if (hit) return view(instanceId, hit, url, true, false);
        throw new KiboError("NOT_CONNECTED", `${key.provider} is not connected`);
      }
      try {
        return view(instanceId, await revalidate(provider, key, id, hit), url, false, true);
      } catch (e) {
        if (!servesStale(e) || !hit) throw e;
        const detail = e instanceof KiboError ? e.detail : String(e);
        deps.events.log(key.provider, "warn", `frame ${id} served stale: ${detail}`);
        return view(instanceId, hit, url, true, false);
      }
    },
    metadata: (key) => deps.providers[imageKey(key).provider].metadata(key),
    async open(token) {
      const grant = widgetTokens.lookup(token) ?? shellTokens.lookup(token);
      if (!grant) return null;
      return {
        path: grant.path,
        name: `frame.${frameExtension(grant.mime)}`,
        mime: grant.mime,
        size: grant.size,
      };
    },
  };
}
