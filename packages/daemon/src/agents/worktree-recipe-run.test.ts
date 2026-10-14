import { afterEach, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type SetupStep, WORKTREE_DEFAULTS, type WorktreeRecipe, type WorktreeSettings } from "@kibo/schema";
import { cleanupTmp, repo, tmp } from "./git-test-kit";
import { runGit } from "./workspace-prep";
import { assertWorktreeSettings, prepareWorktree, runShell, type WorktreeInput } from "./worktree-prep";

afterEach(cleanupTmp);

const RECIPE: WorktreeRecipe = {
  copyFrom: ["{repo}"],
  copy: [".env"],
  env: null,
  after: ["echo {short} >> recipe.log", 'echo "after $KIBO_SHORT_"'],
};

async function prepared(recipe: WorktreeRecipe | null) {
  const parent = tmp();
  const root = await repo("main", join(parent, "emis"));
  writeFileSync(join(root, ".env"), "WEB_PORT=3000\n");
  const runDir = join(tmp(), "run");
  const steps: SetupStep[] = [];
  const settings: WorktreeSettings = { ...WORKTREE_DEFAULTS, pathTemplate: "../emis-{short}", recipe };
  const input: WorktreeInput = {
    root,
    ticketKey: "EMIS-15",
    branchRef: { kind: "git_branch", branch: "feat/compte-non-provisionne", base: null },
    settings,
    runDir,
    git: runGit,
    shell: runShell,
    onSetup: (step) => steps.push(step),
  };
  return { parent, runDir, steps, input };
}

test("a created worktree plays the recipe once, an adopted one never again", async () => {
  const p = await prepared(RECIPE);
  const first = await prepareWorktree(p.input);
  expect(first.cwd).toBe(join(p.parent, "emis-compte-non-provisionne"));
  expect(readFileSync(join(first.cwd, ".env"), "utf8")).toBe("WEB_PORT=3000\n");
  expect(readFileSync(join(first.cwd, "recipe.log"), "utf8")).toBe("compte-non-provisionne\n");
  expect(p.steps.map((s) => `${s.command} ${s.status}`)).toEqual([
    "echo compte-non-provisionne >> recipe.log running",
    "echo compte-non-provisionne >> recipe.log done",
    'echo "after $KIBO_SHORT_" running',
    'echo "after $KIBO_SHORT_" done',
  ]);
  expect(readFileSync(join(p.runDir, "setup.log"), "utf8")).toContain("after compte_non_provisionne\n");
  writeFileSync(join(p.input.root, ".env"), "WEB_PORT=9999\n");
  const again = await prepareWorktree(p.input);
  expect(again.cwd).toBe(first.cwd);
  expect(readFileSync(join(first.cwd, "recipe.log"), "utf8")).toBe("compte-non-provisionne\n");
  expect(readFileSync(join(first.cwd, ".env"), "utf8")).toBe("WEB_PORT=3000\n");
  expect(p.steps).toHaveLength(4);
});

test("the recipe follows the setup command and appends to its log", async () => {
  const p = await prepared(RECIPE);
  const setup = "echo setup-ran && git worktree add {path} {branch}";
  const placed = await prepareWorktree({ ...p.input, settings: { ...p.input.settings, setup } });
  const log = readFileSync(join(p.runDir, "setup.log"), "utf8");
  expect(log.indexOf("setup-ran")).toBeLessThan(log.indexOf("after compte_non_provisionne"));
  expect(readFileSync(join(placed.cwd, "recipe.log"), "utf8")).toBe("compte-non-provisionne\n");
});

test("without a recipe nothing is copied", async () => {
  const p = await prepared(null);
  const placed = await prepareWorktree(p.input);
  expect(() => readFileSync(join(placed.cwd, ".env"))).toThrow();
  expect(p.steps).toEqual([]);
});

test("saving settings checks the recipe templates", () => {
  const settings = { ...WORKTREE_DEFAULTS, recipe: { ...RECIPE, after: ["echo {nope}"] } };
  expect(() => assertWorktreeSettings(settings)).toThrow("INVALID_INPUT");
  expect(() => assertWorktreeSettings({ ...WORKTREE_DEFAULTS, recipe: RECIPE })).not.toThrow();
});
