import { z } from "zod";
import { KiboError } from "./errors";
import { isGitBranchName } from "./git-branch";

export function splitRemote(ref: string): { remote: string | null; branch: string } {
  const at = ref.indexOf("/");
  if (at <= 0) return { remote: null, branch: ref };
  return { remote: ref.slice(0, at), branch: ref.slice(at + 1) };
}

const RemoteBranch = z.string().refine((ref) => {
  const { remote, branch } = splitRemote(ref);
  return remote !== null && !remote.startsWith("-") && isGitBranchName(branch);
});

const leadsWithDash = (ref: string) => ref.startsWith("-") || splitRemote(ref).branch.startsWith("-");

const BaseRef = z
  .string()
  .refine(
    (ref) => !leadsWithDash(ref) && (isGitBranchName(ref) || RemoteBranch.safeParse(ref).success),
    "invalid base ref",
  );

export const WorktreeSettings = z.object({
  baseRef: BaseRef,
  pathTemplate: z.string().min(1).max(200),
  setup: z
    .string()
    .max(1000)
    .nullable()
    .transform((s) => (s === null || s.trim().length === 0 ? null : s.trim())),
});
export type WorktreeSettings = z.infer<typeof WorktreeSettings>;
export const WORKTREE_DEFAULTS: WorktreeSettings = {
  baseRef: "main",
  pathTemplate: ".kibo/worktrees/{slug}",
  setup: null,
};

export type WorktreeVars = { branch: string; slug: string; key: string; path?: string };

function templateValue(name: string, vars: WorktreeVars): string | undefined {
  if (name === "branch" || name === "slug" || name === "key" || name === "path") return vars[name];
  return undefined;
}

export function renderTemplate(template: string, vars: WorktreeVars): string {
  return template.replace(/\{([a-z]+)\}/g, (_, name: string) => {
    const value = templateValue(name, vars);
    if (value === undefined) throw new KiboError("INVALID_INPUT", `unknown template variable {${name}}`);
    return value;
  });
}

const segments = (path: string): string[] => path.split("/").filter((s) => s.length > 0 && s !== ".");

function normalizeSegments(parts: readonly string[]): string[] | null {
  const out: string[] = [];
  for (const part of parts) {
    if (part !== "..") out.push(part);
    else if (out.pop() === undefined) return null;
  }
  return out;
}

export function resolveWorktreePath(root: string, template: string, vars: WorktreeVars): string {
  const rendered = renderTemplate(template, vars);
  if (rendered.startsWith("/"))
    throw new KiboError("INVALID_INPUT", "worktree path must be relative to the repository");
  if (segments(rendered).filter((s) => s === "..").length > 1)
    throw new KiboError("INVALID_INPUT", `worktree path ${rendered} climbs more than one level`);
  const rootParts = segments(root);
  const parts = normalizeSegments([...rootParts, ...segments(rendered)]);
  if (parts === null)
    throw new KiboError("INVALID_INPUT", `worktree path ${rendered} leaves the filesystem root`);
  const below = parts.length > rootParts.length && rootParts.every((p, i) => parts[i] === p);
  const beside =
    parts.length === rootParts.length &&
    rootParts.slice(0, -1).every((p, i) => parts[i] === p) &&
    parts.at(-1) !== rootParts.at(-1);
  if (!below && !beside)
    throw new KiboError("INVALID_INPUT", `worktree path ${rendered} leaves the repository`);
  return `/${parts.join("/")}`;
}

export function integrationBranch(settings: WorktreeSettings | null): string {
  return settings === null ? "main" : splitRemote(settings.baseRef).branch;
}
