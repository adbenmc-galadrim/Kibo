import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  type ComponentSummary,
  type ConfigCommand,
  compareSemver,
  type GuidelineOwner,
  KiboError,
  Page,
  type ProjectCommand,
  type ProjectMeta,
  type ProjectSnapshot,
} from "@kibo/schema";
import type { SeedClient } from "./daemon-client";
import type { Desired, DesiredPage } from "./desired";
import type { Change } from "./reconcile";

export type Step = {
  client: SeedClient;
  desired: Desired;
  dryRun: boolean;
  changes: Change[];
  print: (line: string) => void;
};

const record = (step: Step, kind: Change["kind"], what: string, detail = "") =>
  step.changes.push({ kind, what, detail });

function planned(step: Step, call: unknown): void {
  step.print(`would send ${JSON.stringify(call)}`);
}

export async function ensureProject(step: Step, folder: string): Promise<ProjectMeta | null> {
  const { project } = step.desired;
  const found = (await step.client.rpc({ method: "listProjects" })).find((p) => p.key === project.key);
  if (found && found.name !== project.name)
    throw new KiboError("CONFLICT", `key ${project.key} is taken by project ${found.name}`);
  if (found) {
    record(step, "kept", `project ${project.key}`);
    return found;
  }
  record(step, "created", `project ${project.key}`, project.name);
  const request = { method: "createProject" as const, ...project, folder };
  if (step.dryRun) {
    planned(step, request);
    return null;
  }
  return step.client.rpc(request);
}

export async function ensureNotesDir(step: Step, project: ProjectMeta, notesDir: string): Promise<void> {
  const info = await step.client.rpc({ method: "getNotesDir", projectId: project.id });
  if (info.dir === notesDir) {
    record(step, "kept", "notesDir", notesDir);
    return;
  }
  if (project.folder === null || info.dir !== join(project.folder, "notes"))
    throw new KiboError("CONFLICT", `notes folder is ${info.dir}, chosen by hand: pass --notes ${info.dir}`);
  record(step, "created", "notesDir", notesDir);
  const request = { method: "setNotesDir" as const, projectId: project.id, dir: notesDir };
  if (step.dryRun) return planned(step, request);
  mkdirSync(notesDir, { recursive: true });
  await step.client.rpc(request);
}

async function config(step: Step, command: ConfigCommand): Promise<void> {
  if (step.dryRun) return planned(step, { method: "config", command });
  await step.client.rpc({ method: "config", command });
}

export async function ensureProfileAndGuidelines(step: Step, projectId: string | null): Promise<void> {
  const current = await step.client.rpc({ method: "getConfig" });
  const { profile, guidelines } = step.desired;
  const existing = current.profiles.find((p) => p.name === profile.name);
  if (!existing) {
    record(step, "created", `profile ${profile.name}`);
    await config(step, { method: "createProfile", profile });
  } else if (
    existing.permissionMode !== profile.permissionMode ||
    existing.allow.join("\n") !== profile.allow.join("\n")
  ) {
    record(step, "updated", `profile ${profile.name}`, "permissionMode, allow");
    await config(step, {
      method: "updateProfile",
      profileId: existing.id,
      patch: { permissionMode: profile.permissionMode, allow: profile.allow },
    });
  } else record(step, "kept", `profile ${profile.name}`);

  const owner: GuidelineOwner = { scope: "project", projectId: projectId ?? "new-project" };
  for (const g of guidelines) {
    const found = current.guidelines.find(
      (e) => e.path === g.path && e.owner.scope === "project" && e.owner.projectId === projectId,
    );
    const what = `guideline ${g.path}`;
    if (!found) {
      record(step, "created", what);
      await config(step, { method: "addGuideline", owner, path: g.path, content: g.content });
    } else if (found.content !== g.content) {
      record(step, "updated", what);
      await config(step, { method: "updateGuideline", owner, guidelineId: found.id, content: g.content });
    } else record(step, "kept", what);
  }
}

function componentRefs(
  components: readonly ComponentSummary[],
  manifestVersions: ReadonlyMap<string, string>,
): Map<string, string> {
  const refs = new Map([...manifestVersions].map(([id, version]) => [id, `${id}@${version}`]));
  for (const c of components) {
    const versions = c.versions.filter((v) => v.revoked === null).map((v) => v.version);
    const best = versions.reduce<string | null>(
      (a, v) => (a === null || compareSemver(v, a) > 0 ? v : a),
      null,
    );
    if (best !== null) refs.set(c.id, `${c.id}@${best}`);
  }
  return refs;
}

const topLevel = (pages: readonly Page[], title: string) =>
  pages.find((p) => p.parentId === null && p.title === title) ?? null;

async function ensureInstances(
  step: Step,
  page: DesiredPage,
  target: { id: string } | null,
  snapshot: ProjectSnapshot | null,
  refs: ReadonlyMap<string, string>,
  send: (c: ProjectCommand) => Promise<unknown>,
): Promise<number> {
  let added = 0;
  for (const wanted of page.instances) {
    const placed =
      target &&
      snapshot?.instances.some(
        (i) => i.pageId === target.id && i.component.startsWith(`${wanted.componentId}@`),
      );
    if (placed) continue;
    const component = refs.get(wanted.componentId);
    if (!component) {
      record(step, "drift", `instance ${page.title}: ${wanted.componentId}`, "component not installed");
      continue;
    }
    added += 1;
    await send({
      method: "addInstance",
      pageId: target?.id ?? `new:page:${page.title}`,
      component,
      config: wanted.config,
      ...(wanted.layout ? { layout: wanted.layout } : {}),
    });
  }
  return added;
}

export async function ensurePages(
  step: Step,
  projectId: string | null,
  manifestVersions: ReadonlyMap<string, string>,
): Promise<void> {
  const snapshot = projectId ? await step.client.rpc({ method: "getProject", projectId }) : null;
  const refs = componentRefs(await step.client.rpc({ method: "listComponents" }), manifestVersions);
  const send = async (command: ProjectCommand): Promise<unknown> => {
    if (step.dryRun || projectId === null) return planned(step, { method: "command", command });
    return step.client.rpc({ method: "command", projectId, command });
  };
  for (const page of step.desired.pages) {
    let target = snapshot ? topLevel(snapshot.pages, page.title) : null;
    const isNew = target === null;
    if (isNew) {
      const created = await send({ method: "addPage", title: page.title, kind: page.kind });
      target = created === undefined ? null : Page.parse(created);
    }
    const added = await ensureInstances(step, page, target, isNew ? null : snapshot, refs, send);
    const what = `page ${page.title}`;
    if (isNew) record(step, "created", what);
    else record(step, added > 0 ? "updated" : "kept", what, added > 0 ? "instances" : "");
  }
}
