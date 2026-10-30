import type { EmbedKind, EmbedView } from "@kibo/schema";

export type EmbedGrant = { target: string; kind: EmbedKind; title: string };
export type EmbedService = {
  open(instanceId: string, kind: EmbedKind, target: string, title: string): EmbedView;
  relay(token: string): { html: string; headers: Record<string, string> } | null;
};
