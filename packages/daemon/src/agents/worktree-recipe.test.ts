import { afterEach, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { KiboError, type SetupStep, type WorktreeRecipe } from "@kibo/schema";
import { cleanupTmp, repo, tmp, worktree, worktreeWith } from "./git-test-kit";
import { runGit } from "./workspace-prep";
import { runShell } from "./worktree-prep";
import {
  applyRecipe,
  assertRecipe,
  type RecipeInput,
  type RecipeVars,
  worktreeSiblings,
} from "./worktree-recipe";

afterEach(cleanupTmp);

const SIBLING_ENV = "WEB_PORT=3010\nSERVER_PORT=3011\nDATABASE_URL=postgres://db/emis_dev\n";
const ENV: NonNullable<WorktreeRecipe["env"]> = {
  file: ".env",
  ports: { keys: { WEB_PORT: 3000, SERVER_PORT: 3001 }, from: 0, step: 10, count: 5 },
  replace: { DATABASE_URL: ["emis_dev", "emis_{short_}"] },
  set: { PUBLIC_URL: "http://localhost:{WEB_PORT}" },
};
const RECIPE: WorktreeRecipe = { copyFrom: ["{repo}", "{sibling}"], copy: [".env"], env: ENV, after: [] };

const varsOf = (root: string, path: string): RecipeVars => ({
  branch: "feat/compte-non-provisionne",
  slug: "feat-compte-non-provisionne",
  key: "emis-15",
  path,
  short: "compte-non-provisionne",
  short_: "compte_non_provisionne",
  repo: root,
});

type Fixture = { root: string; dir: string; lines: string[]; steps: SetupStep[]; input: RecipeInput };

async function fixture(
  recipe: Partial<WorktreeRecipe>,
  siblingFiles: Record<string, string> = { ".env": SIBLING_ENV },
): Promise<Fixture> {
  const root = await repo();
  const sibling = await worktreeWith(root, "feat/old", siblingFiles);
  const dir = await worktree(root, "feat/compte-non-provisionne");
  const lines: string[] = [];
  const steps: SetupStep[] = [];
  const input: RecipeInput = {
    recipe: { ...RECIPE, ...recipe },
    root,
    dir,
    vars: varsOf(root, dir),
    siblings: [sibling],
    shell: runShell,
    probe: async (port) => port !== 3000,
    onSetup: (step) => steps.push(step),
    log: (line) => lines.push(line),
  };
  return { root, dir, lines, steps, input };
}

const failure = async (run: Promise<unknown>): Promise<KiboError> => {
  const error = await run.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(error instanceof KiboError)) throw new Error(`expected a KiboError, got ${String(error)}`);
  return error;
};

test("copies, picks free ports, replaces, sets, then runs the after commands from the worktree", async () => {
  const after = [
    'echo "web=$WEB_PORT server=$SERVER_PORT branch=$KIBO_BRANCH path=$KIBO_PATH"; pwd',
    "echo {short} > after.txt",
  ];
  const f = await fixture({ after, copy: [".env", "seed.sql"] });
  const result = await applyRecipe(f.input);
  expect(result).toEqual({
    copied: [".env"],
    missing: ["seed.sql"],
    ports: { WEB_PORT: 3020, SERVER_PORT: 3021 },
  });
  expect(readFileSync(join(f.dir, ".env"), "utf8")).toBe(
    "WEB_PORT=3020\nSERVER_PORT=3021\nDATABASE_URL=postgres://db/emis_compte_non_provisionne\nPUBLIC_URL=http://localhost:3020\n",
  );
  expect(readFileSync(join(f.dir, "after.txt"), "utf8")).toBe("compte-non-provisionne\n");
  const log = f.lines.join("\n");
  const order = [
    "copy .env",
    "fichier manquant : seed.sql",
    "ports WEB_PORT=3020",
    "replace DATABASE_URL",
    "set PUBLIC_URL",
    "$ echo",
  ];
  const at = order.map((mark) => log.indexOf(mark));
  expect(at.every((i) => i >= 0)).toBe(true);
  expect([...at].sort((a, b) => a - b)).toEqual(at);
  expect(log).toContain(`web=3020 server=3021 branch=feat/compte-non-provisionne path=${f.dir}`);
  expect(log).toContain(`\n${realpathSync(f.dir)}\n`);
  expect(f.steps.map((s) => s.status)).toEqual(["running", "done", "running", "done"]);
  expect(f.steps[2]?.command).toBe("echo compte-non-provisionne > after.txt");
});

test("{sibling} is the most recently modified worktree that has the file", async () => {
  const f = await fixture({ env: null }, { ".env": "OLD=1\n" });
  const newer = await worktreeWith(f.root, "feat/newer", { ".env": "NEW=1\n" });
  await worktreeWith(f.root, "feat/none", {});
  const past = new Date(Date.now() - 60_000);
  utimesSync(join(f.input.siblings[0] ?? "", ".env"), past, past);
  const siblings = await worktreeSiblings(f.root, f.dir, runGit);
  expect(siblings).toContain(realpathSync(f.root));
  expect(siblings).not.toContain(f.dir);
  expect(siblings).toHaveLength(4);
  await applyRecipe({ ...f.input, siblings });
  expect(readFileSync(join(f.dir, ".env"), "utf8")).toBe("NEW=1\n");
  expect(f.lines.join("\n")).toContain(`copy .env from ${newer}`);
});

test("{repo} wins over the siblings when it comes first", async () => {
  const f = await fixture({ env: null });
  writeFileSync(join(f.root, ".env"), "ROOT=1\n");
  await applyRecipe(f.input);
  expect(readFileSync(join(f.dir, ".env"), "utf8")).toBe("ROOT=1\n");
});

test("an env file absent after the copies fails the workspace", async () => {
  const f = await fixture({}, {});
  const error = await failure(applyRecipe(f.input));
  expect(error.code).toBe("WORKSPACE_FAILED");
  expect(error.detail).toContain(".env");
});

test("no free port set fails the workspace", async () => {
  const f = await fixture({});
  const error = await failure(applyRecipe({ ...f.input, probe: async () => false }));
  expect(error.code).toBe("WORKSPACE_FAILED");
  expect(error.detail).toContain("no free port");
});

test("a failing after command fails the workspace with the last 20 lines", async () => {
  const f = await fixture({
    env: null,
    after: ["for i in $(seq 1 30); do echo line-$i; done; exit 3", "touch never"],
  });
  const error = await failure(applyRecipe(f.input));
  expect(error.code).toBe("WORKSPACE_FAILED");
  expect(error.detail).toContain("line-11\n");
  expect(error.detail).toContain("line-30");
  expect(error.detail).not.toContain("line-10\n");
  expect(f.steps.map((s) => s.status)).toEqual(["running", "failed"]);
  expect(existsSync(join(f.dir, "never"))).toBe(false);
});

test("a copy never writes outside the worktree through a symlink", async () => {
  const outside = tmp();
  const f = await fixture({ env: null, copy: ["conf/.env"] }, {});
  symlinkSync(outside, join(f.dir, "conf"));
  const sibling = f.input.siblings[0] ?? "";
  mkdirSync(join(sibling, "conf"));
  writeFileSync(join(sibling, "conf", ".env"), "SECRET=1\n");
  const error = await failure(applyRecipe(f.input));
  expect(error.code).toBe("WORKSPACE_FAILED");
  expect(existsSync(join(outside, ".env"))).toBe(false);
});

test("a copy never follows a symlinked target file", async () => {
  const outside = join(tmp(), "victim");
  const f = await fixture({ env: null });
  symlinkSync(outside, join(f.dir, ".env"));
  const error = await failure(applyRecipe(f.input));
  expect(error.code).toBe("WORKSPACE_FAILED");
  expect(existsSync(outside)).toBe(false);
});

test("a source that is a symlink or sits behind a symlinked folder is never copied", async () => {
  const outside = tmp();
  writeFileSync(join(outside, ".env"), "SECRET=1\n");
  const f = await fixture({ env: null, copyFrom: ["{repo}"], copy: [".env", "a/.env"] });
  symlinkSync(join(outside, ".env"), join(f.root, ".env"));
  symlinkSync(outside, join(f.root, "a"));
  const result = await applyRecipe(f.input);
  expect(result.copied).toEqual([]);
  expect(result.missing).toEqual([".env", "a/.env"]);
  expect(existsSync(join(f.dir, ".env"))).toBe(false);
  expect(existsSync(join(f.dir, "a", ".env"))).toBe(false);
  expect(f.lines.join("\n")).toContain("source refusée : .env");
});

test("a refused source falls back to the next one", async () => {
  const outside = tmp();
  writeFileSync(join(outside, ".env"), "SECRET=1\n");
  const f = await fixture({ env: null });
  symlinkSync(join(outside, ".env"), join(f.root, ".env"));
  await applyRecipe(f.input);
  expect(readFileSync(join(f.dir, ".env"), "utf8")).toBe(SIBLING_ENV);
});

test("a replacement value is inserted literally", async () => {
  const f = await fixture({
    env: { ...ENV, ports: null, replace: { DATABASE_URL: ["emis_dev", "x$&y$1"] }, set: {} },
  });
  await applyRecipe(f.input);
  expect(readFileSync(join(f.dir, ".env"), "utf8")).toContain("DATABASE_URL=postgres://db/x$&y$1\n");
});

test("after commands that exceed the delay time out", async () => {
  const f = await fixture({ env: null, after: ["sleep 1000"] });
  const shell: RecipeInput["shell"] = async () => ({ code: 137, output: "", timedOut: true });
  const error = await failure(applyRecipe({ ...f.input, shell }));
  expect(error.code).toBe("TIMEOUT");
  expect(f.steps.map((s) => s.status)).toEqual(["running", "failed"]);
});

test("the recipe is checked when the settings are saved", () => {
  const check = (patch: Partial<WorktreeRecipe>) => () => assertRecipe({ ...RECIPE, ...patch });
  expect(check({ after: ["pnpm dev --port {WEB_PORT} --name {short}"] })).not.toThrow();
  expect(check({ after: ["echo {nope}"] })).toThrow("INVALID_INPUT");
  expect(check({ after: ["echo '{branch}'"] })).toThrow("INVALID_INPUT");
  expect(check({ copyFrom: ["{repo}/{nope}"] })).toThrow("INVALID_INPUT");
  expect(check({ env: { ...ENV, set: { A: "{nope}" } } })).toThrow("INVALID_INPUT");
  expect(check({ env: { ...ENV, replace: { A: ["x", "{nope}"] } } })).toThrow("INVALID_INPUT");
});
