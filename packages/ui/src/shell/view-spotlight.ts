import type { Spotlight } from "@kibo/schema";

export const viewSpotlight = (intent?: Spotlight, question?: string): Spotlight | undefined =>
  intent ?? (question === undefined ? undefined : { kind: "question", id: question });
