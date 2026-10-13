import { afterAll, expect, test } from "bun:test";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { composeWorkSection } from "@kibo/core/overlaps/section";
import { hasSecret } from "@kibo/schema";
import fc from "fast-check";
import { cleanupTmp, tmp } from "../agents/git-test-kit";
import type { GitRunner } from "../agents/workspace-prep";
import { createPeek } from "./peek";
import {
  fakeServices,
  indexedFile,
  NOW,
  ticketRun,
  workspaceIndex,
  worktree,
} from "./peek-fakes.test-helper";
import { createWorkView } from "./work-view";

afterAll(cleanupTmp);

const secret = fc.oneof(
  fc.constant(`ghp_${"z".repeat(30)}`),
  fc.constant(`github_pat_${"y".repeat(24)}`),
  fc.constant(`sk-${"x".repeat(24)}`),
  fc.constant("AKIAQWERTYUIOPASDFGH"),
  fc.constant(`xoxp-${"9".repeat(14)}`),
  fc.constant("DB_PASSWORD = s3cr3t"),
  fc.constant("Authorization: Bearer abc.def"),
  fc.constant("-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----"),
);

const withSecret = fc
  .tuple(fc.string({ maxLength: 40 }), secret, fc.string({ maxLength: 40 }))
  .map(([a, s, b]) => `${a}\n${s}\n${b}`);

const caller = ticketRun("r15", "BOU-15");
const other = ticketRun("r12", "BOU-12");

function root(): string {
  const dir = realpathSync(tmp());
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "a.ts"), "placeholder");
  return dir;
}

test("no secret survives in the content or the diff served by peek_work", async () => {
  const dir = root();
  await fc.assert(
    fc.asyncProperty(withSecret, withSecret, async (content, diff) => {
      const git: GitRunner = async (args) => ({
        code: 0,
        stdout: args[0] === "diff" ? diff : "",
        stderr: "",
      });
      const services = {
        ...fakeServices({
          runs: [caller, other],
          spaces: { r15: worktree("/w/bou-15"), r12: worktree(dir) },
          indexes: { [dir]: workspaceIndex(dir, [indexedFile("src/a.ts", { status: "modified" })]) },
        }),
        git,
        fs: {
          stat: async () => ({ size: content.length, mtimeMs: 1 }),
          read: async () => Buffer.from(content),
        },
      };
      const reply = JSON.parse(await createPeek(services).call(caller, { run: "BOU-12", path: "src/a.ts" }));
      expect(hasSecret(reply.content)).toBe(false);
      expect(hasSecret(reply.diff)).toBe(false);
    }),
    { numRuns: 60 },
  );
});

test("no secret survives in the section built from an index", async () => {
  await fc.assert(
    fc.asyncProperty(secret, fc.string({ maxLength: 20 }), async (name, path) => {
      const services = fakeServices({
        runs: [caller, other],
        spaces: { r12: worktree("/w/bou-12") },
        indexes: {
          "/w/bou-12": workspaceIndex("/w/bou-12", [
            indexedFile(`src/${path}${name}.ts`, { exports: [name] }),
          ]),
        },
      });
      const section = composeWorkSection(await createWorkView(services).parallelWork(caller), NOW) ?? "";
      expect(section).toContain("### ");
      expect(hasSecret(section)).toBe(false);
    }),
    { numRuns: 60 },
  );
});
