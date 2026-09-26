import { z } from "zod";

export const PrState = z.enum(["open", "draft", "merged", "closed"]);
export type PrState = z.infer<typeof PrState>;

export const ExternalRef = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("github_pr"),
    url: z.string().url(),
    number: z.number().int().positive(),
    state: PrState,
  }),
]);
export type ExternalRef = z.infer<typeof ExternalRef>;
