import { expect, test } from "bun:test";
import fc from "fast-check";
import { KiboError } from "./errors";
import {
  integrationBranch,
  plannedWorktree,
  renderTemplate,
  resolveWorktreePath,
  shortSlug,
  singleQuotedVariable,
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

test("a base ref never looks like an option, neither its remote nor its branch", () => {
  const base = (baseRef: string) => WorktreeSettings.safeParse({ ...WORKTREE_DEFAULTS, baseRef }).success;
  for (const bad of ["-main", "origin/--upload-pack=touch", "origin/-dev", "-origin/dev"])
    expect(base(bad)).toBe(false);
  for (const ok of ["main", "origin/dev", "origin/feat/x"]) expect(base(ok)).toBe(true);
});

test("a variable between single quotes is found, double quotes and bare ones are not", () => {
  expect(singleQuotedVariable("pnpm worktree '{branch}'")).toBe("branch");
  expect(singleQuotedVariable("echo 'at {path} now' && make")).toBe("path");
  expect(singleQuotedVariable("a \"b\" 'c {slug}'")).toBe("slug");
  expect(singleQuotedVariable("pnpm worktree {branch}")).toBeNull();
  expect(singleQuotedVariable('pnpm worktree "{branch}"')).toBeNull();
  expect(singleQuotedVariable('echo "it\'s {key}"')).toBeNull();
  expect(singleQuotedVariable("echo \\'{key}")).toBeNull();
  expect(singleQuotedVariable("echo 'done' {key}")).toBeNull();
});

test("the planned worktree follows the ticket branch, its base and the settings", () => {
  const settings = { baseRef: "origin/dev", pathTemplate: "../emis-{slug}", setup: null };
  expect(plannedWorktree({ root: "/code/emis", ticketKey: "EMIS-12", branchRef: null, settings })).toEqual({
    branch: "emis-12",
    base: "origin/dev",
    path: "/code/emis-emis-12",
  });
  const branchRef = { kind: "git_branch" as const, branch: "feat/x", base: "feat/parent" };
  expect(plannedWorktree({ root: "/code/emis", ticketKey: "EMIS-12", branchRef, settings })).toEqual({
    branch: "feat/x",
    base: "feat/parent",
    path: "/code/emis-feat-x",
  });
  expect(
    plannedWorktree({ root: "/r", ticketKey: "KIB-3", branchRef: null, settings: WORKTREE_DEFAULTS }).path,
  ).toBe("/r/.kibo/worktrees/kib-3");
  expect(() =>
    plannedWorktree({
      root: "/r",
      ticketKey: "KIB-3",
      branchRef: null,
      settings: { ...settings, pathTemplate: "/tmp/{slug}" },
    }),
  ).toThrow(KiboError);
});

test("settings stored without a recipe get none", () => {
  const settings = WorktreeSettings.parse({
    baseRef: "origin/dev",
    pathTemplate: "../emis-{slug}",
    setup: null,
  });
  expect(settings.recipe).toBeNull();
});

test("the short slug drops the first segment of the branch", () => {
  expect(shortSlug("feat/compte-non-provisionne")).toBe("compte-non-provisionne");
  expect(shortSlug("feat/a/b")).toBe("a-b");
  expect(shortSlug("main")).toBe("main");
});

test("templates render the short slugs, the repo and the ports", () => {
  const vars = { branch: "feat/compte-non-provisionne", slug: "feat-compte-non-provisionne", key: "emis-15" };
  expect(renderTemplate("../emis-{short_}", { ...vars, short_: "compte_non_provisionne" })).toBe(
    "../emis-compte_non_provisionne",
  );
  expect(renderTemplate("{repo}/.env", { ...vars, repo: "/r" })).toBe("/r/.env");
  expect(renderTemplate("{WEB_PORT}", { ...vars, WEB_PORT: 3010 })).toBe("3010");
  expect(renderTemplate("echo {Home} {UNKNOWN_PORT}", vars)).toBe("echo {Home} {UNKNOWN_PORT}");
  expect(() => renderTemplate("{short}", vars)).toThrow(KiboError);
});

test("the planned worktree renders the short slug", () => {
  const settings = WorktreeSettings.parse({
    baseRef: "origin/dev",
    pathTemplate: "../gereco-{short}",
    setup: null,
  });
  const planned = plannedWorktree({
    root: "/w/gereco",
    ticketKey: "GER-3",
    branchRef: { kind: "git_branch" as const, branch: "feat/c2-1-export", base: null },
    settings,
  });
  expect(planned.path).toBe("/w/gereco-c2-1-export");
});

test("settings with a recipe that leaves the repository are refused", () => {
  const base = { baseRef: "origin/dev", pathTemplate: "../emis-{slug}", setup: null };
  const recipe = { copyFrom: ["{repo}"], copy: [".env"], env: null, after: [] };
  expect(WorktreeSettings.safeParse({ ...base, recipe }).success).toBe(true);
  for (const copy of [["../x"], ["/abs/.env"]])
    expect(WorktreeSettings.safeParse({ ...base, recipe: { ...recipe, copy } }).success).toBe(false);
});
