import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { branchSlug, type SetupStep, shortSlug, type WorktreeRecipe } from "@kibo/schema";
import type { GitRunner } from "../runs/workspace-prep";
import { isFree } from "./port-probe";
import type { ShellRunner } from "./worktree-prep";
import { applyRecipe, type RecipeResult, worktreeSiblings } from "./worktree-recipe";

export type RecipeRun = {
  recipe: WorktreeRecipe;
  root: string;
  dir: string;
  branch: string;
  key: string;
  runDir: string;
  git: GitRunner;
  shell: ShellRunner;
  onSetup?: (step: SetupStep) => void;
};

export async function runRecipe(run: RecipeRun): Promise<RecipeResult> {
  const short = shortSlug(run.branch);
  mkdirSync(run.runDir, { recursive: true, mode: 0o700 });
  const logFile = join(run.runDir, "setup.log");
  return applyRecipe({
    recipe: run.recipe,
    root: run.root,
    dir: run.dir,
    vars: {
      branch: run.branch,
      slug: branchSlug(run.branch),
      key: run.key,
      path: run.dir,
      short,
      short_: short.replaceAll("-", "_"),
      repo: run.root,
    },
    siblings: await worktreeSiblings(run.root, run.dir, run.git),
    shell: run.shell,
    probe: isFree,
    onSetup: run.onSetup,
    log: (line) => appendFileSync(logFile, line.endsWith("\n") ? line : `${line}\n`, { mode: 0o600 }),
  });
}
