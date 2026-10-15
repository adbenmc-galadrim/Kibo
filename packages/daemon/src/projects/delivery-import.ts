import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";
import { listProjects } from "@kibo/core";
import {
  expandHome,
  parseRegistry,
  type RegistryEntry,
  registryToSettings,
} from "@kibo/core/delivery/registry-import";
import {
  type DeliveryImportCandidate,
  KiboError,
  type ProjectDelivery,
  type ProjectMeta,
  type WorktreeSettings,
} from "@kibo/schema";
import { createGit } from "../code/run";
import type { Docs } from "../docs";
import { parseGithubRemote } from "../integrations/github-remote";

export type DeliveryImportDeps = {
  home: string;
  env: Record<string, string | undefined>;
  docs: Pick<Docs, "workspace" | "projectMeta" | "updateProjectMeta">;
  originOf?(folder: string): Promise<string | null>;
};

const FILE_MAX_BYTES = 1_048_576;
const SKILL_REGISTRY = [".claude", "skills", "full-delivery", "projects", "registry.json"];

function readText(path: string): string | null {
  try {
    if (statSync(path).size > FILE_MAX_BYTES) {
      console.error(`[kibo-daemon] ${path} is too large to import`);
      return null;
    }
    return readFileSync(path, "utf8");
  } catch (e) {
    console.error(`[kibo-daemon] cannot read ${path}`, e instanceof Error ? e.message : e);
    return null;
  }
}

const realOf = (path: string): string | null => {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
};

async function gitOrigin(folder: string): Promise<string | null> {
  const r = await createGit(folder).run(["remote", "get-url", "origin"]);
  return r.code === 0 ? r.stdout.trim() || null : null;
}

const registryPathOf = (deps: DeliveryImportDeps, given?: string): string =>
  given ?? deps.env.DELIVERY_REGISTRY ?? join(deps.home, ...SKILL_REGISTRY);

function readRegistry(path: string): Record<string, RegistryEntry> {
  if (!existsSync(path)) {
    console.error(`[kibo-daemon] no delivery registry at ${path}`);
    return {};
  }
  const text = readText(path);
  if (text === null) throw new KiboError("INVALID_INPUT", `delivery registry ${path} is unreadable`);
  try {
    return parseRegistry(JSON.parse(text));
  } catch (e) {
    if (e instanceof KiboError) throw e;
    throw new KiboError("INVALID_INPUT", `delivery registry ${path} is not JSON`);
  }
}

type LocalProject = { id: string; folder: string };

function localProjects(deps: DeliveryImportDeps): LocalProject[] {
  return listProjects(deps.docs.workspace).flatMap((p) => {
    const folder = deps.docs.projectMeta(p.id).folder;
    return folder ? [{ id: p.id, folder }] : [];
  });
}

const originUnknown = (folder: string) => (e: unknown) => {
  console.error(`[kibo-daemon] no git origin for ${folder}`, e instanceof Error ? e.message : e);
  return null;
};

async function matchOf(deps: DeliveryImportDeps, entry: RegistryEntry, projects: LocalProject[]) {
  const repo = realOf(expandHome(entry.repo, deps.home));
  const byFolder = repo === null ? undefined : projects.find((p) => realOf(p.folder) === repo);
  if (byFolder) return byFolder.id;
  if (!entry.remote) return null;
  const originOf = deps.originOf ?? gitOrigin;
  for (const project of projects) {
    const slug = parseGithubRemote(await originOf(project.folder).catch(originUnknown(project.folder)));
    if (slug === entry.remote) return project.id;
  }
  return null;
}

function settingsFor(
  deps: DeliveryImportDeps,
  entry: RegistryEntry,
  current: Pick<ProjectMeta, "worktree" | "delivery"> | null,
): { worktree: WorktreeSettings; delivery: ProjectDelivery; notices: string[] } {
  const profileText = entry.profile ? readText(expandHome(entry.profile, deps.home)) : null;
  const imported = registryToSettings(entry, { home: deps.home, profileText });
  return {
    worktree: { ...imported.worktree, setup: current?.worktree?.setup ?? null },
    delivery: {
      ...imported.delivery,
      agent: current?.delivery?.agent ?? null,
      addDirs: imported.delivery.addDirs.filter((dir) => existsSync(dir)),
    },
    notices: imported.notices,
  };
}

export async function importDelivery(
  deps: DeliveryImportDeps,
  registryPath?: string,
): Promise<{ registryPath: string; candidates: DeliveryImportCandidate[] }> {
  const path = registryPathOf(deps, registryPath);
  const projects = localProjects(deps);
  const candidates: DeliveryImportCandidate[] = [];
  for (const [name, entry] of Object.entries(readRegistry(path))) {
    const matched = await matchOf(deps, entry, projects);
    const current = matched === null ? null : deps.docs.projectMeta(matched);
    const { notices, ...preview } = settingsFor(deps, entry, current);
    candidates.push({
      name,
      repo: expandHome(entry.repo, deps.home),
      remote: entry.remote ?? null,
      matched,
      preview,
      notices,
    });
  }
  return { registryPath: path, candidates };
}

export async function applyDeliveryImport(
  deps: DeliveryImportDeps,
  input: { projectId: string; name: string; registryPath?: string },
): Promise<ProjectMeta> {
  const path = registryPathOf(deps, input.registryPath);
  const registry = readRegistry(path);
  const entry = Object.hasOwn(registry, input.name) ? registry[input.name] : undefined;
  if (!entry) throw new KiboError("NOT_FOUND", `project ${input.name} is not in ${path}`);
  const current = deps.docs.projectMeta(input.projectId);
  const { worktree, delivery } = settingsFor(deps, entry, current);
  return deps.docs.updateProjectMeta(input.projectId, { worktree, delivery }, false);
}
