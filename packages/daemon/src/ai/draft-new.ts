import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  type ComponentDraft,
  type ComponentFormat,
  type DraftAttachment,
  DraftKind,
  formatIssue,
  formatsOf,
  KiboError,
  type StartComponentDraftInput,
} from "@kibo/schema";
import { writeAttachments } from "./draft-attachments";
import { copySource, type DraftPaths, prepareDraft, removeDraft } from "./draft-files";
import { draftBrief } from "./draft-launch";
import type { DraftStore } from "./draft-store";
import type { ComponentCatalog, Devkit } from "./ports";
import { draftKiboFiles } from "./prompts";

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
    attachments: [],
    revisions: 0,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  if (ctx.store.active().some((d) => d.componentId === input.id))
    throw new KiboError("CONFLICT", `a draft of ${input.id} is already open`);
  if (input.mode === "create") {
    const issue = formatIssue({ kind: input.kind, formats: input.formats });
    if (issue) throw new KiboError("INVALID_INPUT", issue);
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

export type PrepareContext = { devkit: Devkit; catalog: ComponentCatalog };

export async function prepareNewDraft(
  ctx: PrepareContext,
  paths: DraftPaths,
  req: { draft: ComponentDraft; input: StartComponentDraftInput },
): Promise<DraftAttachment[]> {
  const { draft, input } = req;
  const formats = (f: ComponentFormat[] | undefined) => f ?? formatsOf({ kind: draft.kind });
  await prepareDraft({
    paths,
    kiboFiles: draftKiboFiles(draftBrief(draft, [])),
    fill:
      input.mode === "create"
        ? (dir) =>
            ctx.devkit.scaffold({
              dir,
              id: draft.componentId,
              title: draft.title,
              kind: draft.kind,
              withServer: draft.withServer,
              formats: formats(input.formats),
            })
        : async (dir) => copySource(ctx.catalog.sourceDir(draft.componentId), dir),
  });
  try {
    return writeAttachments(paths.attachmentsDir, input.attachments, []);
  } catch (e) {
    removeDraft(paths);
    throw e;
  }
}
