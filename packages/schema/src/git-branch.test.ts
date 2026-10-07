import { expect, test } from "bun:test";
import { branchSlug, GitBranchRef, ImportRef, isGitBranchName } from "./git-branch";

test("git branch names follow check-ref-format", () => {
  for (const ok of ["main", "feat/schema-affaires", "fix/a.b", "emis-12", "release-1.0"])
    expect(isGitBranchName(ok)).toBe(true);
  for (const bad of [
    "",
    "/x",
    "x/",
    "a..b",
    "a b",
    "a~b",
    "a^b",
    "a:b",
    "a?b",
    "a*b",
    "a[b",
    "a\\b",
    "a//b",
    "a.lock",
    "a.",
    "@{x",
    "x".repeat(201),
  ])
    expect(isGitBranchName(bad)).toBe(false);
});

test("slug replaces slashes and refs parse with defaults", () => {
  expect(branchSlug("feat/schema-affaires")).toBe("feat-schema-affaires");
  expect(GitBranchRef.parse({ kind: "git_branch", branch: "feat/x", base: null }).base).toBeNull();
  expect(GitBranchRef.safeParse({ kind: "git_branch", branch: "bad branch", base: null }).success).toBe(
    false,
  );
  expect(ImportRef.parse({ kind: "import_ref", source: "plan", id: "C0-9" })).toEqual({
    kind: "import_ref",
    source: "plan",
    id: "C0-9",
  });
  expect(ImportRef.safeParse({ kind: "import_ref", source: "Plan", id: "C0-9" }).success).toBe(false);
});

test("git branch names are printable ascii only", () => {
  for (const bad of ["café", "a\tb", "a\u0001b", ".hidden", "a/.b"]) expect(isGitBranchName(bad)).toBe(false);
});

test("a branch name never looks like an option", () => {
  for (const bad of ["-x", "--upload-pack=touch", "-b/x"]) expect(isGitBranchName(bad)).toBe(false);
  expect(isGitBranchName("feat/-x")).toBe(true);
  expect(GitBranchRef.safeParse({ kind: "git_branch", branch: "feat/x", base: "-main" }).success).toBe(false);
});
