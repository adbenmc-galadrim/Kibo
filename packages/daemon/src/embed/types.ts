import type { ComponentManifest, EmbedKind, EmbedView } from "@kibo/schema";

export type EmbedGrant = { target: string; kind: EmbedKind; title: string };
export type EmbedService = {
  open(instanceId: string, kind: EmbedKind, target: string, title: string): EmbedView;
  relay(token: string): { html: string; headers: Record<string, string> } | null;
};
export type EmbedChecker = { check(target: string, refresh: boolean): Promise<void> };
export type EmbedCallContext = { projectId: string; instanceId: string; manifest: ComponentManifest };
export type EmbedGate = { open(ctx: EmbedCallContext, url: string, refresh?: boolean): Promise<EmbedView> };
