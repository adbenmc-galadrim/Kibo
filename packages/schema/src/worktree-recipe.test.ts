import { expect, test } from "bun:test";
import { WorktreeRecipe } from "./worktree-recipe";

const PORTS = { keys: { WEB_PORT: 3000, SERVER_PORT: 3001 }, from: 1, step: 10, count: 50 };
const ENV: NonNullable<WorktreeRecipe["env"]> = {
  file: ".env",
  ports: PORTS,
  replace: { DATABASE_URL: ["emis_dev", "emis_{short_}"] },
  set: { PUBLIC_URL: "http://localhost:{WEB_PORT}" },
};
const EMIS: WorktreeRecipe = {
  copyFrom: ["{repo}", "{sibling}"],
  copy: [".env"],
  env: ENV,
  after: ["pnpm install"],
};

test("the emis recipe parses", () => {
  expect(WorktreeRecipe.parse(EMIS)).toEqual(EMIS);
  expect(WorktreeRecipe.parse({ ...EMIS, env: null }).env).toBeNull();
  expect(WorktreeRecipe.parse({ ...EMIS, env: { ...ENV, ports: null } }).env?.ports).toBeNull();
});

test("copied files stay relative and never climb", () => {
  expect(WorktreeRecipe.safeParse({ ...EMIS, copy: ["../x"] }).success).toBe(false);
  expect(WorktreeRecipe.safeParse({ ...EMIS, copy: ["a/../../x"] }).success).toBe(false);
  expect(WorktreeRecipe.safeParse({ ...EMIS, copy: ["/abs/.env"] }).success).toBe(false);
  expect(WorktreeRecipe.safeParse({ ...EMIS, copy: [""] }).success).toBe(false);
  expect(WorktreeRecipe.safeParse({ ...EMIS, copy: ["apps/web/.env.local"] }).success).toBe(true);
  expect(WorktreeRecipe.safeParse({ ...EMIS, env: { ...ENV, file: "../.env" } }).success).toBe(false);
});

test("the recipe is bounded", () => {
  expect(WorktreeRecipe.safeParse({ ...EMIS, copyFrom: Array(9).fill("{repo}") }).success).toBe(false);
  expect(WorktreeRecipe.safeParse({ ...EMIS, after: Array(9).fill("pnpm i") }).success).toBe(false);
  const ports = (over: object) => ({ ...EMIS, env: { ...ENV, ports: { ...PORTS, ...over } } });
  expect(WorktreeRecipe.safeParse(ports({ count: 201 })).success).toBe(false);
  expect(WorktreeRecipe.safeParse(ports({ step: 0 })).success).toBe(false);
  const nine = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`P${i}`, 3000 + i]));
  expect(WorktreeRecipe.safeParse(ports({ keys: nine })).success).toBe(false);
  expect(WorktreeRecipe.safeParse(ports({ keys: { "web-port": 3000 } })).success).toBe(false);
  expect(WorktreeRecipe.safeParse(ports({ keys: { WEB_PORT: 70000 } })).success).toBe(false);
  expect(WorktreeRecipe.safeParse({ ...EMIS, extra: 1 }).success).toBe(false);
});
