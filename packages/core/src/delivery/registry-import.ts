import {
  isSafeAddDir,
  KiboError,
  type ProjectDelivery,
  RelativeFile,
  resolveWorktreePath,
  WORKTREE_DEFAULTS,
  WorktreeRecipe,
  type WorktreeSettings,
} from "@kibo/schema";
import { z } from "zod";
import { parseDeliveryProfile } from "./profile";

const Path = z.string().min(1).max(4096);
const Strings = z.array(z.string()).default([]);

const RegistryEnv = z.object({
  file: z.string(),
  ports: z
    .object({ keys: z.record(z.number()), from: z.number(), step: z.number(), count: z.number() })
    .nullable()
    .optional(),
  replace: z.record(z.tuple([z.string(), z.string()])).optional(),
  set: z.record(z.string()).optional(),
});

export const RegistryEntry = z.object({
  root: Path.optional(),
  repo: Path,
  remote: z.string().optional(),
  base: z.string().min(1),
  profile: Path.optional(),
  memory: Path.optional(),
  briefs: Path.optional(),
  reports: Path.optional(),
  todo: Path.optional(),
  plan: z.object({ idPattern: z.string().optional() }).optional(),
  worktree: z
    .object({ dir: Path, copyFrom: Strings, copy: Strings, env: RegistryEnv.optional(), after: Strings })
    .optional(),
});
export type RegistryEntry = z.infer<typeof RegistryEntry>;

const RegistryFile = z.object({ projects: z.record(RegistryEntry) });

export function parseRegistry(json: unknown): Record<string, RegistryEntry> {
  const parsed = RegistryFile.safeParse(json);
  if (!parsed.success)
    throw new KiboError("INVALID_INPUT", `invalid delivery registry: ${parsed.error.message}`);
  return parsed.data.projects;
}

export const expandHome = (path: string, home: string): string =>
  path === "~" ? home : path.startsWith("~/") ? `${home}${path.slice(1)}` : path;

const RENAMED: Record<string, string> = { dashed: "slug", slug: "short", slug_: "short_" };
export const renameVars = (text: string): string =>
  text.replace(/\{(dashed|slug_|slug)\}/g, (_match, name: string) => `{${RENAMED[name] ?? name}}`);

const partsOf = (path: string): string[] => path.split("/").filter((s) => s.length > 0);

export function relativePath(from: string, to: string): string {
  const a = partsOf(from);
  const b = partsOf(to);
  let common = 0;
  while (common < a.length && common < b.length && a[common] === b[common]) common++;
  const up = a.slice(common).map(() => "..");
  return [...up, ...b.slice(common)].join("/") || ".";
}

const parentOf = (path: string): string => `/${partsOf(path).slice(0, -1).join("/")}`;

type Ctx = { home: string; profileText: string | null };
type Notices = string[];
type Worktree = NonNullable<RegistryEntry["worktree"]>;

function recipeEnv(env: Worktree["env"]): WorktreeRecipe["env"] {
  if (!env) return null;
  const replace = Object.entries(env.replace ?? {}).map(([key, [pattern, value]]) => [
    key,
    [renameVars(pattern), renameVars(value)],
  ]);
  const set = Object.entries(env.set ?? {}).map(([key, value]) => [key, renameVars(value)]);
  return {
    file: env.file,
    ports: env.ports ?? null,
    replace: Object.fromEntries(replace),
    set: Object.fromEntries(set),
  };
}

function recipeOf(worktree: Worktree, home: string, notices: Notices): WorktreeRecipe {
  const copy = worktree.copy.filter((path) => {
    const ok = RelativeFile.safeParse(path).success;
    if (!ok) notices.push(`Copie refusée : ${path}`);
    return ok;
  });
  return {
    copyFrom: worktree.copyFrom.map((path) => renameVars(expandHome(path, home))),
    copy,
    env: recipeEnv(worktree.env),
    after: worktree.after.map(renameVars),
  };
}

function validRecipe(recipe: WorktreeRecipe, notices: Notices): WorktreeRecipe | null {
  const parsed = WorktreeRecipe.safeParse(recipe);
  if (parsed.success) return parsed.data;
  notices.push(`Recette ignorée : ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  return null;
}

const SAMPLE_VARS = { branch: "feat/x", slug: "feat-x", short: "x", short_: "x", key: "key-1" };

function acceptedTemplate(template: string, notices: Notices): string {
  try {
    resolveWorktreePath("/repo", template, SAMPLE_VARS);
    return template;
  } catch (e) {
    if (!(e instanceof KiboError)) throw e;
    notices.push(`Dossier des worktrees refusé : ${template}`);
    return WORKTREE_DEFAULTS.pathTemplate;
  }
}

function worktreeOf(entry: RegistryEntry, home: string, notices: Notices): WorktreeSettings {
  const base = { ...WORKTREE_DEFAULTS, baseRef: `origin/${entry.base}` };
  if (!entry.worktree) return base;
  const dir = expandHome(entry.worktree.dir, home);
  const template = renameVars(relativePath(expandHome(entry.repo, home), dir));
  return {
    ...base,
    pathTemplate: acceptedTemplate(template, notices),
    recipe: validRecipe(recipeOf(entry.worktree, home, notices), notices),
  };
}

const compiles = (pattern: string): boolean => {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

function idPatternOf(pattern: string | undefined, notices: Notices): string | null {
  if (pattern === undefined) return null;
  if (pattern.length <= 200 && compiles(pattern)) return pattern;
  notices.push(`Format des identifiants invalide : ${pattern}`);
  return null;
}

function addDirsOf(paths: (string | null)[], home: string, notices: Notices): string[] {
  const dirs: string[] = [];
  for (const dir of paths) {
    if (dir === null || dirs.includes(dir)) continue;
    if (isSafeAddDir(dir, home)) dirs.push(dir);
    else notices.push(`Dossier refusé : ${dir}`);
  }
  return dirs;
}

function profileOf(entry: RegistryEntry, ctx: Ctx, notices: Notices) {
  if (ctx.profileText === null) {
    if (entry.profile) notices.push(`Profil illisible : ${expandHome(entry.profile, ctx.home)}`);
    return { allow: [], publication: null };
  }
  const profile = parseDeliveryProfile(ctx.profileText);
  for (const rule of profile.rejected) notices.push(`Règle refusée par Kibo : ${rule}`);
  return { allow: profile.allow, publication: profile.publication };
}

export function registryToSettings(
  entry: RegistryEntry,
  ctx: Ctx,
): { worktree: WorktreeSettings; delivery: ProjectDelivery; notices: string[] } {
  const notices: Notices = [];
  const abs = (path: string | undefined): string | null => {
    const expanded = path === undefined ? null : expandHome(path, ctx.home);
    return expanded?.startsWith("/") ? expanded : null;
  };
  const profile = profileOf(entry, ctx, notices);
  const idPattern = idPatternOf(entry.plan?.idPattern, notices);
  const worktree = worktreeOf(entry, ctx.home, notices);
  const root = abs(entry.root);
  const memory = abs(entry.memory);
  const delivery: ProjectDelivery = {
    agent: null,
    root,
    profile: abs(entry.profile),
    memory,
    briefs: abs(entry.briefs),
    reports: abs(entry.reports),
    todo: abs(entry.todo),
    idPattern,
    publication: profile.publication,
    allow: profile.allow,
    addDirs: addDirsOf([root, memory && parentOf(memory)], ctx.home, notices),
  };
  return { worktree, delivery, notices };
}
