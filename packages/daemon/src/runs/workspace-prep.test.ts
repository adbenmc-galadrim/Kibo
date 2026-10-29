import { afterEach, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cleanupTmp, tmp } from "../testing/git-test-kit";
import { writeRunContext } from "./workspace-prep";

afterEach(cleanupTmp);

test("the run context is written privately and never outside the run folder", () => {
  const runDir = join(tmp(), "run");
  const out = writeRunContext(runDir, [
    { path: "context/1-workspace/guidelines/git.md", content: "# Git" },
    { path: "CLAUDE.md", content: "# Guidelines Kibo" },
    { path: "brief.md", content: "# KIB-1" },
  ]);
  expect(out).toEqual({ systemPromptFile: join(runDir, "CLAUDE.md"), briefFile: join(runDir, "brief.md") });
  expect(readFileSync(join(runDir, "context/1-workspace/guidelines/git.md"), "utf8")).toBe("# Git");
  expect(statSync(out.systemPromptFile).mode & 0o777).toBe(0o600);
  expect(statSync(runDir).mode & 0o777).toBe(0o700);
  expect(() => writeRunContext(runDir, [{ path: "../evil.md", content: "" }])).toThrow("WORKSPACE_FAILED");
  expect(() => writeRunContext(join(tmp(), "r2"), [{ path: "brief.md", content: "" }])).toThrow(
    "WORKSPACE_FAILED",
  );
});
