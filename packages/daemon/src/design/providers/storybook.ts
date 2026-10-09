import {
  KiboError,
  STORYBOOK_CACHE_MS,
  STORYBOOK_INDEX_MAX_BYTES,
  STORYBOOK_INDEX_MS,
  STORYBOOK_PROBE_MS,
  StorybookIndex,
} from "@kibo/schema";
import { isLoopbackHost } from "../../integrations/net";
import type { IntegrationFetch, InternalRule } from "../../integrations/types";

export type StorybookClient = {
  probe(origin: string): Promise<boolean>;
  index(origin: string): Promise<StorybookIndex | null>;
  forget(origin: string): void;
};
export type StorybookClientDeps = { fetch: IntegrationFetch; now(): number; log(message: string): void };

const PROBE_MAX_BYTES = 65_536;
const decoder = new TextDecoder();
type Entry<T> = { at: number; value: Promise<T> };

function rulesFor(origin: URL): InternalRule[] {
  const loopback = isLoopbackHost(origin.hostname);
  return [{ host: origin.hostname, suffix: false, auth: false, ...(loopback && { insecureLoopback: true }) }];
}

const codeOf = (e: unknown) => (e instanceof KiboError ? `${e.code}: ${e.detail}` : String(e));

function parseIndex(text: string): StorybookIndex {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new KiboError("REMOTE_REJECTED", "index.json is not valid json");
  }
  const parsed = StorybookIndex.safeParse(raw);
  if (!parsed.success) throw new KiboError("REMOTE_REJECTED", "index.json has an unexpected shape");
  return parsed.data;
}

export function createStorybook(deps: StorybookClientDeps): StorybookClient {
  const probes = new Map<string, Entry<boolean>>();
  const indexes = new Map<string, Entry<StorybookIndex | null>>();
  const cached = <T>(cache: Map<string, Entry<T>>, origin: string, load: (u: URL) => Promise<T>) => {
    const u = new URL(origin);
    const hit = cache.get(u.origin);
    if (hit && deps.now() - hit.at < STORYBOOK_CACHE_MS) return hit.value;
    const value = load(u);
    cache.set(u.origin, { at: deps.now(), value });
    return value;
  };
  const probe = async (u: URL): Promise<boolean> => {
    try {
      const res = await deps.fetch(
        `${u.origin}/iframe.html`,
        { method: "GET", timeoutMs: STORYBOOK_PROBE_MS, maxBytes: PROBE_MAX_BYTES },
        rulesFor(u),
      );
      return res.status >= 200 && res.status < 300;
    } catch {
      return false;
    }
  };
  const loadIndex = async (u: URL): Promise<StorybookIndex> => {
    const res = await deps.fetch(
      `${u.origin}/index.json`,
      { method: "GET", timeoutMs: STORYBOOK_INDEX_MS, maxBytes: STORYBOOK_INDEX_MAX_BYTES },
      rulesFor(u),
    );
    if (res.status === 404) throw new KiboError("REMOTE_NOT_FOUND", "no index.json");
    if (res.status < 200 || res.status >= 300)
      throw new KiboError("REMOTE_UNAVAILABLE", `index.json answered ${res.status}`);
    if (res.truncated) throw new KiboError("TOO_LARGE", "index.json exceeds the limit");
    return parseIndex(decoder.decode(res.body));
  };
  const index = async (u: URL): Promise<StorybookIndex | null> => {
    try {
      return await loadIndex(u);
    } catch (e) {
      if (!(e instanceof KiboError && e.code === "REMOTE_NOT_FOUND"))
        deps.log(`storybook ${u.origin} index ignored (${codeOf(e)})`);
      return null;
    }
  };
  return {
    probe: (origin) => cached(probes, origin, probe),
    index: (origin) => cached(indexes, origin, index),
    forget(origin) {
      const key = new URL(origin).origin;
      probes.delete(key);
      indexes.delete(key);
    },
  };
}
