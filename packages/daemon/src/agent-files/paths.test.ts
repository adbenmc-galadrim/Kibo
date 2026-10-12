import { expect, test } from "bun:test";
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { agentPath, agentsDir, assertInside } from "./paths";
import { makeTestHome, PROJECT_ID } from "./test-home.test-helper";

const codeOf = (fn: () => unknown): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof KiboError ? e.code : String(e);
  }
};

test("a global agent lives in <claude home>/agents, even before the folder exists", () => {
  const h = makeTestHome();
  expect(agentPath(h.roots, "global:a")).toBe(join(h.claudeHome, "agents", "a.md"));
});

test("a project agent lives in <folder>/.claude/agents", () => {
  const h = makeTestHome();
  expect(agentPath(h.roots, `project:${PROJECT_ID}:a`)).toBe(
    join(h.projectFolder, ".claude", "agents", "a.md"),
  );
});

test("a project without a local folder has no agents folder", () => {
  const h = makeTestHome({ projectFolder: false });
  expect(codeOf(() => agentPath(h.roots, `project:${PROJECT_ID}:a`))).toBe("PROJECT_FOLDER_MISSING");
  expect(agentsDir(h.roots, "global", null)).toBe(join(h.claudeHome, "agents"));
});

test("a Kibo agent is the kibo-<id> file of the global folder", () => {
  const h = makeTestHome();
  expect(agentPath(h.roots, "system:demo")).toBe(join(h.claudeHome, "agents", "kibo-demo.md"));
});

test("a path that leaves its root is refused", async () => {
  const h = makeTestHome();
  const root = join(h.claudeHome, "agents");
  await expect(assertInside(root, `${root}/../x`)).rejects.toMatchObject({ code: "FORBIDDEN" });
});

test("a symbolic link to a file outside is refused", async () => {
  const h = makeTestHome();
  const root = join(h.claudeHome, "agents");
  mkdirSync(root, { recursive: true });
  symlinkSync("/etc/passwd", join(root, "evil.md"));
  await expect(assertInside(root, join(root, "evil.md"))).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(codeOf(() => agentPath(h.roots, "global:evil"))).toBe("FORBIDDEN");
});

test("a root reached through a symbolic link is accepted with its real path", async () => {
  const h = makeTestHome();
  const real = join(h.root, "dotfiles", "agents");
  mkdirSync(real, { recursive: true });
  symlinkSync(real, join(h.claudeHome, "agents"));
  expect(await assertInside(join(h.claudeHome, "agents"), join(h.claudeHome, "agents", "a.md"))).toBe(
    join(real, "a.md"),
  );
});

test("a project whose .claude/agents links outside its folder is refused for writing", () => {
  const h = makeTestHome();
  const outside = join(h.root, "ailleurs");
  mkdirSync(outside, { recursive: true });
  mkdirSync(join(h.projectFolder, ".claude"), { recursive: true });
  symlinkSync(outside, join(h.projectFolder, ".claude", "agents"));
  expect(codeOf(() => agentPath(h.roots, `project:${PROJECT_ID}:a`))).toBe("FORBIDDEN");
});

test("a project whose .claude links outside its folder is refused for writing", () => {
  const h = makeTestHome();
  const outside = join(h.root, "ailleurs");
  mkdirSync(outside, { recursive: true });
  symlinkSync(outside, join(h.projectFolder, ".claude"));
  expect(codeOf(() => agentPath(h.roots, `project:${PROJECT_ID}:a`))).toBe("FORBIDDEN");
});
