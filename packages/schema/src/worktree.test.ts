import { expect, test } from "bun:test";
import fc from "fast-check";
import { KiboError } from "./errors";
import {
  integrationBranch,
  renderTemplate,
  resolveWorktreePath,
  splitRemote,
  WORKTREE_DEFAULTS,
  WorktreeSettings,
} from "./worktree";

const vars = { branch: "feat/x", slug: "feat-x", key: "emis-12" };

test("templates render their variables and refuse unknown ones", () => {
  expect(renderTemplate("../emis-{slug}", vars)).toBe("../emis-feat-x");
  expect(renderTemplate("pnpm worktree {branch}", { ...vars, path: "/p" })).toBe("pnpm worktree feat/x");
  expect(() => renderTemplate("{nope}", vars)).toThrow(KiboError);
  expect(() => renderTemplate("{path}", vars)).toThrow(KiboError);
});

test("a worktree path stays in the repo, below it, or beside it", () => {
  expect(resolveWorktreePath("/home/a/emis", ".kibo/worktrees/{slug}", vars)).toBe(
    "/home/a/emis/.kibo/worktrees/feat-x",
  );
  expect(resolveWorktreePath("/home/a/emis", "../emis-{slug}", vars)).toBe("/home/a/emis-feat-x");
  for (const bad of ["../../x/{slug}", "/tmp/{slug}", "{slug}/../../x", "..", "../emis", "."])
    expect(() => resolveWorktreePath("/home/a/emis", bad, vars)).toThrow(KiboError);
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z0-9{}/._-]{1,40}$/), (template) => {
      try {
        const path = resolveWorktreePath("/home/a/emis", template, vars);
        return path.startsWith("/home/a/emis/") || /^\/home\/a\/[^/]+$/.test(path);
      } catch (e) {
        return e instanceof KiboError && e.code === "INVALID_INPUT";
      }
    }),
  );
});

test("integration branch drops the remote and defaults to main", () => {
  expect(splitRemote("origin/dev")).toEqual({ remote: "origin", branch: "dev" });
  expect(splitRemote("main")).toEqual({ remote: null, branch: "main" });
  expect(integrationBranch({ ...WORKTREE_DEFAULTS, baseRef: "origin/dev" })).toBe("dev");
  expect(integrationBranch(null)).toBe("main");
  expect(
    WorktreeSettings.safeParse({
      baseRef: "origin/dev",
      pathTemplate: "../emis-{slug}",
      setup: "pnpm worktree {branch}",
    }).success,
  ).toBe(true);
  expect(WorktreeSettings.safeParse({ baseRef: "bad ref", pathTemplate: "x", setup: null }).success).toBe(
    false,
  );
  expect(WorktreeSettings.parse({ baseRef: "main", pathTemplate: "x", setup: "  " }).setup).toBeNull();
});
