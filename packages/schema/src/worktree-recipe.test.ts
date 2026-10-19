import { expect, test } from "bun:test";
import { WorktreeRecipe } from "./worktree-recipe";

const PORTS = { keys: { WEB_PORT: 3000, SERVER_PORT: 3001 }, from: 1, step: 10, count: 50 };
const ENV: NonNullable<WorktreeRecipe["env"]> = {
  file: ".env",
  ports: PORTS,
  replace: { DATABASE_URL: ["silo_dev", "silo_{short_}"] },
  set: { PUBLIC_URL: "http://localhost:{WEB_PORT}" },
};
const SILO: WorktreeRecipe = {
  copyFrom: ["{repo}", "{sibling}"],
  copy: [".env"],
  env: ENV,
  after: ["pnpm install"],
};

test("the silo recipe parses", () => {
  expect(WorktreeRecipe.parse(SILO)).toEqual(SILO);
  expect(WorktreeRecipe.parse({ ...SILO, env: null }).env).toBeNull();
  expect(WorktreeRecipe.parse({ ...SILO, env: { ...ENV, ports: null } }).env?.ports).toBeNull();
});

test("copied files stay relative and never climb", () => {
  expect(WorktreeRecipe.safeParse({ ...SILO, copy: ["../x"] }).success).toBe(false);
  expect(WorktreeRecipe.safeParse({ ...SILO, copy: ["a/../../x"] }).success).toBe(false);
  expect(WorktreeRecipe.safeParse({ ...SILO, copy: ["/abs/.env"] }).success).toBe(false);
  expect(WorktreeRecipe.safeParse({ ...SILO, copy: [""] }).success).toBe(false);
  expect(WorktreeRecipe.safeParse({ ...SILO, copy: ["apps/web/.env.local"] }).success).toBe(true);
  expect(WorktreeRecipe.safeParse({ ...SILO, env: { ...ENV, file: "../.env" } }).success).toBe(false);
});

test("the recipe is bounded", () => {
  expect(WorktreeRecipe.safeParse({ ...SILO, copyFrom: Array(9).fill("{repo}") }).success).toBe(false);
  expect(WorktreeRecipe.safeParse({ ...SILO, after: Array(9).fill("pnpm i") }).success).toBe(false);
  const ports = (over: object) => ({ ...SILO, env: { ...ENV, ports: { ...PORTS, ...over } } });
  expect(WorktreeRecipe.safeParse(ports({ count: 201 })).success).toBe(false);
  expect(WorktreeRecipe.safeParse(ports({ step: 0 })).success).toBe(false);
  const nine = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`P${i}`, 3000 + i]));
  expect(WorktreeRecipe.safeParse(ports({ keys: nine })).success).toBe(false);
  expect(WorktreeRecipe.safeParse(ports({ keys: { "web-port": 3000 } })).success).toBe(false);
  expect(WorktreeRecipe.safeParse(ports({ keys: { WEB_PORT: 70000 } })).success).toBe(false);
  expect(WorktreeRecipe.safeParse({ ...SILO, extra: 1 }).success).toBe(false);
});

test("sources are absolute or start from the repo or a sibling", () => {
  const from = (copyFrom: string[]) => WorktreeRecipe.safeParse({ ...SILO, copyFrom }).success;
  expect(from(["/Users/a/silo", "{repo}/config", "{sibling}"])).toBe(true);
  expect(from(["../silo"])).toBe(false);
  expect(from(["silo"])).toBe(false);
  expect(from(["~/silo"])).toBe(false);
});

test("a replacement pattern must compile", () => {
  const replace = (pattern: string) =>
    WorktreeRecipe.safeParse({ ...SILO, env: { ...ENV, replace: { DATABASE_URL: [pattern, "x"] } } }).success;
  expect(replace("silo_(dev|test)")).toBe(true);
  expect(replace("silo_(dev")).toBe(false);
});

test("port keys never override a reserved environment variable", () => {
  const keys = (name: string) =>
    WorktreeRecipe.safeParse({ ...SILO, env: { ...ENV, ports: { ...PORTS, keys: { [name]: 3000 } } } })
      .success;
  for (const name of [
    "PATH",
    "HOME",
    "SHELL",
    "USER",
    "LD_PRELOAD",
    "DYLD_INSERT_LIBRARIES",
    "KIBO_PATH",
    "NODE_OPTIONS",
  ])
    expect(keys(name)).toBe(false);
  expect(keys("WEB_PORT")).toBe(true);
});
