import { z } from "zod";
import { StorybookOriginUrl } from "./design";

export const PortEnvName = z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/);
export const StorybookSettings = z.object({ origin: StorybookOriginUrl, portEnv: PortEnvName });
export type StorybookSettings = z.infer<typeof StorybookSettings>;
export const STORYBOOK_DEFAULTS: StorybookSettings = {
  origin: "http://localhost:6006",
  portEnv: "STORYBOOK_PORT",
};

export type StorybookOrigin = {
  origin: string;
  label: string;
  branch: string | null;
  path: string | null;
  reachable: boolean;
};

export const STORYBOOK_PROBE_MS = 2_000;
export const STORYBOOK_INDEX_MS = 3_000;
export const STORYBOOK_INDEX_MAX_BYTES = 4 * 1024 * 1024;
export const STORYBOOK_CACHE_MS = 30_000;
export const ENV_FILE_MAX_BYTES = 65_536;

const PORT_MIN = 1024;
const PORT_MAX = 65535;
const PORT_TEXT = /^\d{1,5}$/;

const unquoted = (value: string): string => {
  const quote = value[0];
  if (value.length >= 2 && (quote === '"' || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1);
  }
  return value;
};

const portOf = (value: string): number | null => {
  const text = unquoted(value.trim()).trim();
  if (!PORT_TEXT.test(text)) return null;
  const port = Number(text);
  return port >= PORT_MIN && port <= PORT_MAX ? port : null;
};

const definitionOf = (line: string, name: string): string | null => {
  const trimmed = line.trim().replace(/^export\s+/, "");
  const eq = trimmed.indexOf("=");
  if (eq < 0 || trimmed.slice(0, eq).trim() !== name) return null;
  return trimmed.slice(eq + 1);
};

export function parseEnvPort(text: string, name: string): number | null {
  for (const line of text.split(/\r?\n/)) {
    const value = definitionOf(line, name);
    if (value !== null) return portOf(value);
  }
  return null;
}

export function worktreeOrigin(configured: string, port: number): string {
  const u = new URL(configured);
  return `${u.protocol}//${u.hostname}:${port}`;
}

export const StorybookIndex = z
  .object({
    entries: z.record(
      z.string(),
      z.object({ id: z.string(), title: z.string(), name: z.string() }).passthrough(),
    ),
  })
  .passthrough();
export type StorybookIndex = z.infer<typeof StorybookIndex>;

export type StoryLookup = { kind: "named"; name: string } | { kind: "missing" } | { kind: "unknown" };

export function lookupStory(index: StorybookIndex | null, storyId: string): StoryLookup {
  if (index === null) return { kind: "unknown" };
  const entry = Object.hasOwn(index.entries, storyId) ? index.entries[storyId] : undefined;
  return entry ? { kind: "named", name: `${entry.title} / ${entry.name}` } : { kind: "missing" };
}
