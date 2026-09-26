import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { parseDiff } from "./parse-diff";
import { hunkPatch } from "./patch";

const DIFF = [
  "diff --git a/src/ticket.ts b/src/ticket.ts",
  "index 1111111..2222222 100644",
  "--- a/src/ticket.ts",
  "+++ b/src/ticket.ts",
  "@@ -38,3 +38,4 @@ export const TicketSchema",
  " export const TicketSchema = z.object({",
  "-  parentId: z.string().nullable(),",
  "+  key: z.string(),",
  "+  statusId: z.string(),",
  " });",
  "@@ -50 +51 @@ export function toIndexRow",
  "-  return 1",
  "\\ No newline at end of file",
  "+  return 2",
  "\\ No newline at end of file",
  "",
].join("\n");

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    if (error instanceof KiboError) return error.code;
    throw error;
  }
}

describe("hunkPatch", () => {
  test("rebuilds a single hunk patch", () => {
    const d = parseDiff(DIFF, "src/ticket.ts", null);
    expect(hunkPatch(d, 1)).toBe(
      [
        "diff --git a/src/ticket.ts b/src/ticket.ts",
        "--- a/src/ticket.ts",
        "+++ b/src/ticket.ts",
        "@@ -50 +51 @@ export function toIndexRow",
        "-  return 1",
        "\\ No newline at end of file",
        "+  return 2",
        "\\ No newline at end of file",
        "",
      ].join("\n"),
    );
    expect(codeOf(() => hunkPatch(d, 5))).toBe("GIT_STALE");
    expect(codeOf(() => hunkPatch(d, -1))).toBe("GIT_STALE");
  });

  test("quotes paths git would otherwise misread", () => {
    const d = parseDiff(DIFF, 'a "b"\t\\c.ts', null);
    expect(hunkPatch(d, 0).split("\n").slice(0, 3)).toEqual([
      'diff --git "a/a \\"b\\"\\t\\\\c.ts" "b/a \\"b\\"\\t\\\\c.ts"',
      '--- "a/a \\"b\\"\\t\\\\c.ts"',
      '+++ "b/a \\"b\\"\\t\\\\c.ts"',
    ]);
    expect(hunkPatch(parseDiff(DIFF, "été 🚀.ts", null), 0).split("\n")[1]).toBe("--- a/été 🚀.ts");
  });

  describe("is accepted by git apply", () => {
    const dir = mkdtempSync(join(tmpdir(), "kibo-patch-"));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));
    const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
    const git = (args: string[], stdin?: string): string => {
      const out = Bun.spawnSync(["git", "-C", dir, ...args], {
        env,
        stdin: stdin ? Buffer.from(stdin) : "ignore",
      });
      if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${out.stderr.toString()}`);
      return out.stdout.toString();
    };
    git(["init", "-q"]);
    git(["config", "user.email", "t@kibo.local"]);
    git(["config", "user.name", "Kibo"]);

    for (const name of ["with space.ts", 'quote"inside.ts', "tab\tinside.ts", "été 🚀.ts", "  padded  "]) {
      test(JSON.stringify(name), () => {
        const before = Array.from({ length: 30 }, (_, i) => `line ${i}`);
        const after = before.map((l, i) => (i === 2 || i === 25 ? `${l} changed` : l));
        writeFileSync(join(dir, name), `${before.join("\n")}\n`);
        git(["add", "--", name]);
        git(["commit", "-q", "-m", "init"]);
        writeFileSync(join(dir, name), after.join("\n"));
        const d = parseDiff(git(["diff", "--no-color", "--", name]), name, null);
        expect(d.hunks).toHaveLength(2);
        git(["apply", "--cached", "--whitespace=nowarn", "-"], hunkPatch(d, 1));
        const staged = parseDiff(git(["diff", "--cached", "--no-color", "--", name]), name, null);
        expect(staged.hunks.map((h) => h.lines.filter((l) => l.kind === "add").map((l) => l.text))).toEqual([
          ["line 25 changed", "line 29"],
        ]);
      });
    }
  });
});
