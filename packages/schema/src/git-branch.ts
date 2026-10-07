import { z } from "zod";

const PRINTABLE = /^[\x21-\x7e]+$/;
const FORBIDDEN = /(\.\.|@\{|\/\/|[~^:?*[\\])/;

export function isGitBranchName(name: string): boolean {
  if (name.length === 0 || name.length > 200 || name.startsWith("-")) return false;
  if (name.startsWith("/") || name.endsWith("/") || name.endsWith(".") || name.endsWith(".lock"))
    return false;
  if (name.split("/").some((part) => part.length === 0 || part.startsWith(".") || part.endsWith(".lock")))
    return false;
  return PRINTABLE.test(name) && !FORBIDDEN.test(name);
}

export const GitBranchName = z.string().min(1).max(200).refine(isGitBranchName, "invalid git branch name");
export const branchSlug = (branch: string): string => branch.replaceAll("/", "-");

export const GitBranchRef = z.object({
  kind: z.literal("git_branch"),
  branch: GitBranchName,
  base: GitBranchName.nullable(),
});
export type GitBranchRef = z.infer<typeof GitBranchRef>;

export const ImportSource = z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/);
export const ImportRef = z.object({
  kind: z.literal("import_ref"),
  source: ImportSource,
  id: z.string().min(1).max(64),
});
export type ImportRef = z.infer<typeof ImportRef>;
