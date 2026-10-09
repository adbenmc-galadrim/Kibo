import { z } from "zod";

export const EMBED_KINDS = ["game", "storybook"] as const;
export const EmbedKind = z.enum(EMBED_KINDS);
export type EmbedKind = z.infer<typeof EmbedKind>;

export type EmbedAttributes = { sandbox: string; allow: string };
export const EMBED_ATTRIBUTES: Readonly<Record<EmbedKind, EmbedAttributes>> = {
  game: {
    sandbox: "allow-scripts allow-same-origin allow-pointer-lock",
    allow:
      "gamepad; autoplay; pointer-lock; fullscreen 'none'; camera 'none'; microphone 'none'; geolocation 'none'",
  },
  storybook: {
    sandbox: "allow-scripts allow-same-origin allow-forms",
    allow:
      "fullscreen 'none'; camera 'none'; microphone 'none'; geolocation 'none'; gamepad 'none'; autoplay 'none'",
  },
};

export const EMBED_URL_MAX = 2048;
export const EMBED_TTL_MS = 900_000;
export const EMBED_TOKENS_PER_INSTANCE = 16;
export const EMBED_TOKENS_SHELL = 64;
export const EMBED_CHECK_TTL_MS = 3_600_000;
export const EMBED_CHECK_ERROR_TTL_MS = 60_000;
export const EMBED_CHECK_CHALLENGE_TTL_MS = 300_000;
export const EMBED_CHECK_MAX = 256;
export const EMBED_CHECK_TIMEOUT_MS = 5_000;
export const EMBED_CHECK_MAX_BYTES = 65_536;

export const EmbedView = z.object({
  url: z.string().url(),
  kind: EmbedKind,
  sandbox: z.string(),
  allow: z.string(),
  expiresAt: z.number(),
  target: z.string().url(),
});
export type EmbedView = z.infer<typeof EmbedView>;

export const EMBED_TARGET_PROBLEMS = [
  "not-a-url",
  "insecure",
  "credentials",
  "port",
  "host-not-declared",
] as const;
export type EmbedTargetProblem = (typeof EMBED_TARGET_PROBLEMS)[number];

export function embedTargetProblem(url: string, embeds: readonly string[]): EmbedTargetProblem | null {
  if (url.length > EMBED_URL_MAX || !URL.canParse(url)) return "not-a-url";
  const u = new URL(url);
  if (u.protocol !== "https:") return "insecure";
  if (u.username !== "" || u.password !== "") return "credentials";
  if (u.port !== "") return "port";
  return embeds.includes(u.hostname) ? null : "host-not-declared";
}

export type EmbedCheck =
  | { ok: true; challenged?: true }
  | { ok: false; code: "EMBED_REFUSED" | "REMOTE_NOT_FOUND" | "REMOTE_REJECTED" | "REMOTE_UNAVAILABLE" };
