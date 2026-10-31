import { z } from "zod";

const EMBED_KINDS = ["storybook"] as const;
export const EmbedKind = z.enum(EMBED_KINDS);
export type EmbedKind = z.infer<typeof EmbedKind>;

type EmbedAttributes = { sandbox: string; allow: string };
export const EMBED_ATTRIBUTES: Readonly<Record<EmbedKind, EmbedAttributes>> = {
  storybook: {
    sandbox: "allow-scripts allow-same-origin allow-forms",
    allow:
      "fullscreen 'none'; camera 'none'; microphone 'none'; geolocation 'none'; gamepad 'none'; autoplay 'none'",
  },
};
export const EMBED_TTL_MS = 900_000;
export const EMBED_TOKENS_PER_INSTANCE = 16;
export const EMBED_TOKENS_SHELL = 64;

export const EmbedView = z.object({
  url: z.string().url(),
  kind: EmbedKind,
  sandbox: z.string(),
  allow: z.string(),
  expiresAt: z.number(),
  target: z.string().url(),
});
export type EmbedView = z.infer<typeof EmbedView>;
