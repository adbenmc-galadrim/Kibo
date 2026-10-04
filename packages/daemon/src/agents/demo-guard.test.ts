import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { demoRunGuard, demoWorkspaceGuard } from "./demo-guard";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const runDir = () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "kibo-demo-guard-")));
  dirs.push(dir);
  mkdirSync(join(dir, "workspace"));
  return dir;
};

test("the demo agent writes and reads inside its workspace only", () => {
  const dir = runDir();
  const guard = demoWorkspaceGuard(join(dir, "workspace"));
  expect(guard({ tool: "Write", input: { file_path: join(dir, "workspace/notes.md") } })).toBeNull();
  expect(guard({ tool: "Read", input: { file_path: "notes.md" } })).toBeNull();
  expect(guard({ tool: "Write", input: { file_path: join(dir, "escape.md") } })).toEqual({
    decision: "deny",
    reason: "the demo agent stays in its workspace",
  });
  expect(guard({ tool: "Edit", input: { file_path: "../../escape.md" } })?.decision).toBe("deny");
  expect(guard({ tool: "Read", input: { file_path: "/etc/passwd" } })?.decision).toBe("deny");
  expect(guard({ tool: "Grep", input: { pattern: "x", path: "/" } })?.decision).toBe("deny");
  expect(guard({ tool: "NotebookEdit", input: { notebook_path: "/tmp/x.ipynb" } })?.decision).toBe("deny");
});

test("the brief next to the workspace stays readable, nothing else of the run folder", () => {
  const dir = runDir();
  const guard = demoWorkspaceGuard(join(dir, "workspace"));
  expect(guard({ tool: "Read", input: { file_path: join(dir, "brief.md") } })).toBeNull();
  expect(guard({ tool: "Write", input: { file_path: join(dir, "brief.md") } })?.decision).toBe("deny");
  expect(guard({ tool: "Read", input: { file_path: join(dir, "CLAUDE.md") } })?.decision).toBe("deny");
});

test("a symbolic link inside the workspace cannot lead outside", () => {
  const dir = runDir();
  symlinkSync(tmpdir(), join(dir, "workspace/out"));
  const guard = demoWorkspaceGuard(join(dir, "workspace"));
  expect(guard({ tool: "Write", input: { file_path: join(dir, "workspace/out/x.md") } })?.decision).toBe(
    "deny",
  );
});

test("tools without a path and the question tool pass", () => {
  const guard = demoWorkspaceGuard(join(runDir(), "workspace"));
  expect(guard({ tool: "mcp__kibo__ask_user", input: { question: "?" } })).toBeNull();
  expect(guard({ tool: "Bash", input: { command: "kibo component test ." } })).toBeNull();
  expect(guard({ tool: "Write", input: null })).toBeNull();
});

test("only a demo run is guarded, and a demo run without workspace yet touches no file", () => {
  const dir = runDir();
  const cwd = join(dir, "workspace");
  const outside = { tool: "Write", input: { file_path: join(dir, "escape.md") } };
  expect(demoRunGuard({ profileId: "opus", cwd })).toBeNull();
  expect(demoRunGuard({ profileId: "demo", cwd })?.(outside)?.decision).toBe("deny");
  expect(demoRunGuard({ profileId: "demo", cwd: null })?.(outside)?.decision).toBe("deny");
});
