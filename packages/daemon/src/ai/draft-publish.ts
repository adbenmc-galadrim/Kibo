import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  addedPermissions,
  type ComponentDraft,
  type ComponentDraftDetails,
  compareSemver,
  type FileDiff,
  type FinalizeComponentDraftInput,
  type FinalizeResult,
  formatRef,
  grantedOf,
  KiboError,
  type PublishPreview,
  type ReviewComponentDraftInput,
} from "@kibo/schema";
import {
  agentFiles,
  type DraftPaths,
  draftPaths,
  readDraftManifest,
  removeDraft,
  writeDraftManifest,
} from "./draft-files";
import { isSafeFile, present } from "./draft-fs";
import { applyDraftEvent, type DraftEvent } from "./draft-machine";
import { installDraft } from "./draft-source";
import type { DraftStore } from "./draft-store";
import { proposeVersion } from "./draft-version";
import type { AiEvents, Clock, ComponentCatalog, Devkit, Differ, ProjectAccess } from "./ports";

export type PublishDeps = {
  store: DraftStore;
  devkit: Devkit;
  catalog: ComponentCatalog;
  projects: ProjectAccess;
  differ: Differ;
  events: AiEvents;
  clock: Clock;
  home: string;
};

const firstLine = (text: string) => (text.split("\n")[0] ?? "").trim().slice(0, 200);
const sameBytes = (a: string, b: string) => Buffer.compare(readFileSync(a), readFileSync(b)) === 0;
const shown = (d: ComponentDraft) => d.status === "review" || d.status === "permissions";
const fileIn = (root: string, rel: string) => (isSafeFile(join(root, rel)) ? join(root, rel) : null);

async function held<T>(
  set: Set<string>,
  key: string,
  refusal: KiboError,
  work: () => Promise<T>,
): Promise<T> {
  if (set.has(key)) throw refusal;
  set.add(key);
  try {
    return await work();
  } finally {
    set.delete(key);
  }
}

export function createDraftPublisher(deps: PublishDeps) {
  const busy = new Set<string>();
  const publishing = new Set<string>();
  const paths = (d: ComponentDraft): DraftPaths => draftPaths(deps.home, d.id);

  const apply = (d: ComponentDraft, e: DraftEvent) => {
    const next = applyDraftEvent(d, e, deps.clock.now());
    deps.store.save(next);
    deps.events.publish({ type: "draft.changed", draftId: next.id, status: next.status });
    return next;
  };

  const exclusive = <T>(id: string, work: () => Promise<T>) =>
    held(busy, id, new KiboError("INVALID_INPUT", "this draft is already being processed"), work);

  const assertAbovePublished = (d: ComponentDraft, version: string, reviewedHash: string | null) => {
    const latest = deps.catalog.latest(d.componentId);
    if (!latest) return;
    const order = compareSemver(version, latest.version);
    if (order > 0) return;
    if (order === 0 && reviewedHash !== null && latest.origin === "ai") {
      if (latest.hash === reviewedHash) return;
      throw new KiboError(
        "VERSION_EXISTS",
        `${version} is already published with other sources; review the draft again with a higher version`,
      );
    }
    throw new KiboError("INVALID_INPUT", `version must be greater than ${latest.version}`);
  };

  const diffOf = async (d: ComponentDraft): Promise<FileDiff[]> => {
    const p = paths(d);
    const out: FileDiff[] = [];
    for (const path of agentFiles(p, d.withServer)) {
      const before = fileIn(p.baseDir, path);
      const after = fileIn(p.dir, path);
      if (before && after && sameBytes(before, after)) continue;
      out.push(await deps.differ({ path, before, after }));
    }
    return out;
  };

  const proposedChanges = (d: ComponentDraft) => {
    const line = d.mode === "modify" ? firstLine(d.description) : "";
    return line ? [line] : [];
  };

  const previewOf = async (d: ComponentDraft): Promise<PublishPreview> => {
    const p = paths(d);
    const manifest = readDraftManifest(p.dir);
    const validation = deps.store.report(d.id);
    if (!validation) throw new KiboError("INTERNAL", `draft ${d.id} has no validation report`);
    const latest = d.mode === "modify" ? deps.catalog.latest(d.componentId) : null;
    const granted = grantedOf(manifest);
    const reviewed = d.status === "permissions";
    const base = latest
      ? {
          version: latest.version,
          permissions: grantedOf(latest.manifest),
          configVersion: latest.manifest.configVersion,
        }
      : null;
    return {
      id: d.componentId,
      title: manifest.title,
      from: latest?.version ?? null,
      to: reviewed
        ? manifest.version
        : proposeVersion(base, { permissions: granted, configVersion: manifest.configVersion }),
      hash: reviewed ? await deps.devkit.hash(p.dir) : null,
      status: latest ? "update" : "new",
      usages: latest ? deps.catalog.usages(d.componentId) : [],
      changes: reviewed ? manifest.changes : proposedChanges(d),
      newPermissions: addedPermissions(latest?.granted ?? null, granted),
      migration: null,
      validation,
    };
  };

  const details = async (draftId: string): Promise<ComponentDraftDetails> => {
    const d = deps.store.get(draftId);
    const visible = shown(d);
    return {
      ...d,
      report: deps.store.report(draftId),
      diff: visible ? await diffOf(d) : [],
      manifest: visible ? readDraftManifest(paths(d).dir) : null,
      publish: visible ? await previewOf(d) : null,
    };
  };

  const checkSource = async (d: ComponentDraft, p: DraftPaths, src: string, hash: string) => {
    if (d.mode === "create" && present(src) && (await deps.devkit.hash(src)) !== hash)
      throw new KiboError("CONFLICT", `components/src/${d.componentId} exists`);
    if (d.mode === "modify") {
      const current = await deps.devkit.hash(src);
      if (current !== hash && current !== (await deps.devkit.hash(p.baseDir)))
        throw new KiboError("CONFLICT", "the component source changed since the draft started");
    }
  };

  const review = (input: ReviewComponentDraftInput) =>
    exclusive(input.draftId, async () => {
      const d = deps.store.get(input.draftId);
      if (!shown(d)) throw new KiboError("INVALID_INPUT", `draft is ${d.status}`);
      assertAbovePublished(d, input.version, null);
      const dir = paths(d).dir;
      writeDraftManifest(dir, { ...readDraftManifest(dir), version: input.version, changes: input.changes });
      if (d.status === "review") apply(d, { type: "reviewed" });
      else deps.events.publish({ type: "draft.changed", draftId: d.id, status: d.status });
      return details(input.draftId);
    });

  const publishInstalled = async (d: ComponentDraft, p: DraftPaths, input: FinalizeComponentDraftInput) => {
    const install = installDraft(p.dir, deps.catalog.sourceDir(d.componentId));
    try {
      const publish = await deps.catalog.publish({
        id: d.componentId,
        strategy: input.strategy,
        origin: "ai",
      });
      if (publish.version.hash !== input.hash)
        throw new KiboError("HASH_MISMATCH", "the published sources differ from the reviewed draft");
      install.commit();
      return publish;
    } catch (e) {
      install.rollback();
      throw e;
    }
  };

  const finalizeDraft = async (
    d: ComponentDraft,
    input: FinalizeComponentDraftInput,
  ): Promise<FinalizeResult> => {
    if (d.status !== "permissions") throw new KiboError("INVALID_INPUT", `draft is ${d.status}`);
    const p = paths(d);
    if (readDraftManifest(p.dir).version !== input.version)
      throw new KiboError("INVALID_INPUT", "version differs from the reviewed one");
    assertAbovePublished(d, input.version, input.hash);
    if ((await deps.devkit.hash(p.dir)) !== input.hash)
      throw new KiboError("HASH_MISMATCH", "the draft changed since review");
    if (input.target && !deps.projects.pageExists(input.target.projectId, input.target.pageId))
      throw new KiboError("NOT_FOUND", "target page not found");
    await checkSource(d, p, deps.catalog.sourceDir(d.componentId), input.hash);
    const publish = await publishInstalled(d, p, input);
    const version =
      publish.needsApproval || publish.version.trust !== input.trust
        ? await deps.catalog.approve({
            id: d.componentId,
            version: publish.version.version,
            hash: publish.version.hash,
            trust: input.trust,
          })
        : publish.version;
    const instance = input.target
      ? await deps.projects.addInstance(
          input.target.projectId,
          input.target.pageId,
          formatRef(d.componentId, version.version),
        )
      : null;
    apply(d, { type: "finalized" });
    removeDraft(p);
    return { publish, version, instanceId: instance?.id ?? null };
  };

  const finalize = (input: FinalizeComponentDraftInput): Promise<FinalizeResult> =>
    exclusive(input.draftId, () => {
      const d = deps.store.get(input.draftId);
      const refusal = new KiboError("CONFLICT", `another draft of ${d.componentId} is being published`);
      return held(publishing, d.componentId, refusal, () => finalizeDraft(d, input));
    });

  const isProcessing = (draftId: string) => busy.has(draftId);

  return { details, review, finalize, isProcessing };
}
