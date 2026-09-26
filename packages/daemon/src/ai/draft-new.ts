import { existsSync } from "node:fs";
import { join } from "node:path";
import { type ComponentDraft, DraftKind, KiboError, type StartComponentDraftInput } from "@kibo/schema";
import type { DraftStore } from "./draft-store";
import type { ComponentCatalog } from "./ports";

export type NewDraftContext = { store: DraftStore; catalog: ComponentCatalog; id: string; now: number };

export function newDraft(input: StartComponentDraftInput, ctx: NewDraftContext): ComponentDraft {
  const common = {
    id: ctx.id,
    componentId: input.id,
    description: input.description,
    runId: null,
    sessionId: null,
    status: "describing" as const,
    attempts: 0,
    failure: null,
    incidents: [],
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  if (ctx.store.active().some((d) => d.componentId === input.id))
    throw new KiboError("CONFLICT", `a draft of ${input.id} is already open`);
  if (input.mode === "create") {
    if (ctx.catalog.isTaken(input.id)) throw new KiboError("CONFLICT", `component id ${input.id} is taken`);
    return {
      ...common,
      mode: "create",
      title: input.title,
      kind: input.kind,
      withServer: input.withServer,
      baseVersion: null,
    };
  }
  const latest = ctx.catalog.latest(input.id);
  const src = ctx.catalog.sourceDir(input.id);
  if (!latest || (latest.origin !== "user" && latest.origin !== "ai") || !existsSync(src))
    throw new KiboError("NOT_FOUND", `no user component ${input.id}`);
  const kind = DraftKind.safeParse(latest.manifest.kind);
  if (!kind.success)
    throw new KiboError("INVALID_INPUT", `a ${latest.manifest.kind} cannot be modified with AI`);
  return {
    ...common,
    mode: "modify",
    title: latest.manifest.title,
    kind: kind.data,
    withServer: existsSync(join(src, "server.ts")),
    baseVersion: latest.version,
  };
}
