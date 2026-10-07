import { expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ARCHIVED, archive, CLAUDE_POINTER, kiboRedirect } from "./archive";
import { FIXTURE } from "./reconcile.test-kit";

function copyFixture(): string {
  const dir = join(mkdtempSync(join(tmpdir(), "import-emis-archive-")), "emis");
  cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

test("the pilotage files move to the archive, KIBO.md redirects and CLAUDE.md loses its section 4", () => {
  const dir = copyFixture();
  const claude = readFileSync(join(dir, "CLAUDE.md"), "utf8");
  const moved = archive(dir, "2026-10-07");
  const target = join(dir, "archive-2026-10-07");
  expect(moved).toEqual(expect.arrayContaining(["tmp/plan-data.js", "tmp/briefs", "TODO.md", "CLAUDE.md"]));
  for (const path of ARCHIVED) expect(existsSync(join(dir, path))).toBe(path === "KIBO.md");
  expect(readdirSync(join(target, "tmp", "briefs")).sort()).toEqual(["C0-2.md", "C1-1.md"]);
  expect(readFileSync(join(target, "tmp", "reponses.json"), "utf8")).toContain("Oui, un seul bouton.");
  expect(readFileSync(join(target, "CLAUDE.md"), "utf8")).toBe(claude);
  expect(readFileSync(join(dir, "KIBO.md"), "utf8")).toBe(kiboRedirect("2026-10-07"));
  const rewritten = readFileSync(join(dir, "CLAUDE.md"), "utf8");
  expect(rewritten).not.toContain("## 4.");
  expect(rewritten).toContain("## 3. Git");
  expect(rewritten.trimEnd().endsWith(CLAUDE_POINTER)).toBe(true);
});

test("archiving twice does nothing the second time", () => {
  const dir = copyFixture();
  archive(dir, "2026-10-07");
  const claude = readFileSync(join(dir, "CLAUDE.md"), "utf8");
  expect(archive(dir, "2026-10-07")).toEqual([]);
  expect(archive(dir, "2026-10-08")).toEqual([]);
  expect(existsSync(join(dir, "archive-2026-10-08"))).toBe(false);
  expect(readFileSync(join(dir, "CLAUDE.md"), "utf8")).toBe(claude);
  expect(readFileSync(join(dir, "archive-2026-10-07", "KIBO.md"), "utf8")).toContain("# Journal (fictif)");
});
