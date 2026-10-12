import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { hasSecret, KiboError, type RunAction } from "@kibo/schema";
import fc from "fast-check";
import { runView } from "../questions/questions.test-helper";
import { discoverSkills } from "./discover";
import { cleanSkillDirs, skillsFixture, tempDir } from "./fakes.test-helper";
import { readInstalledPlugins } from "./plugins";
import { createSkillReviews } from "./reviews";
import { openSkillReviewStore } from "./reviews-store";
import { createSkillUses } from "./uses-store";

cleanSkillDirs();

function fingerprint(root: string): string {
  const hash = createHash("sha256");
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const info = lstatSync(path);
      hash.update(`${path}:${info.mode}:${info.size}:${info.mtimeMs}\n`);
      if (info.isSymbolicLink()) hash.update(readlinkSync(path));
      else if (info.isDirectory()) walk(path);
      else hash.update(readFileSync(path));
    }
  };
  walk(root);
  return hash.digest("hex");
}

const tables = (db: Database): Record<string, number> =>
  Object.fromEntries(
    (
      db.query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
        name: string;
      }[]
    ).map(({ name }) => [name, (db.query(`SELECT COUNT(*) AS n FROM "${name}"`).get() as { n: number }).n]),
  );

const used: RunAction = {
  tool: "Skill",
  kind: "skill",
  label: "A utilisé",
  target: "deploy",
  outcome: "ok",
  detail: null,
  patch: null,
  tests: null,
};

const SECRET = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";
const skillArb = fc.constantFrom("deploy", "superpowers:brainstorming", "zzz", "Bad Id");
const noteArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 40 }),
  fc.constant(`token ${SECRET}`),
  fc.constant("1\n2\n3\n4"),
  fc.constant(""),
);
const suggestionArb = fc.option(
  fc.oneof(fc.string({ maxLength: 60 }), fc.constant(`x ${SECRET}`), fc.constant("y".repeat(100_001))),
  { nil: undefined },
);
const reviewArb = fc.record({
  skill: skillArb,
  verdict: fc.constantFrom("ok", "improve", "bof"),
  note: noteArb,
  suggestion: suggestionArb.map((content) => (content === undefined ? undefined : { content })),
});
const callArb = fc.oneof(
  fc.record({ reviews: fc.array(reviewArb, { minLength: 0, maxLength: 4 }) }),
  fc.constant("not an object"),
);

test("no sequence of skill_review calls changes a file; only review rows appear, masked", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(callArb, { minLength: 1, maxLength: 6 }), async (calls) => {
      const f = skillsFixture();
      const home = tempDir();
      const db = new Database(join(home, "runs.db"), { create: true, strict: true });
      const uses = createSkillUses(db);
      uses.record("r1", [used, { ...used, target: "superpowers:brainstorming" }], 1);
      const skills = await discoverSkills(f.roots, f.projects, await readInstalledPlugins(f.pluginsRoot));
      const store = openSkillReviewStore(home);
      const reviews = createSkillReviews({
        store,
        uses,
        skillPath: (id) => {
          const skill = skills.find((s) => s.id === id);
          return skill ? { path: skill.path, hash: skill.hash } : null;
        },
        emit: () => {},
      });
      const before = [fingerprint(f.claudeHome), fingerprint(f.project)];
      const rowsBefore = tables(db);
      for (const call of calls) {
        try {
          await reviews.record(runView({ id: "r1" }), call);
        } catch (e) {
          expect(e).toBeInstanceOf(KiboError);
          expect(e).toMatchObject({ code: "INVALID_INPUT" });
        }
      }
      expect([fingerprint(f.claudeHome), fingerprint(f.project)]).toEqual(before);
      const rowsAfter = tables(db);
      for (const [name, n] of Object.entries(rowsAfter)) {
        if (name === "skill_reviews" || name === "skill_review_events" || name === "sqlite_sequence")
          continue;
        expect([name, n]).toEqual([name, rowsBefore[name] ?? 0]);
      }
      const stored = store.byRun("r1");
      expect(stored.every((r) => !hasSecret(r.note) && !hasSecret(r.suggestion ?? ""))).toBe(true);
      expect(stored.every((r) => r.skillId === "deploy" || r.skillId === "superpowers:brainstorming")).toBe(
        true,
      );
      for (const skillId of ["deploy", "superpowers:brainstorming"])
        expect(stored.filter((r) => r.skillId === skillId && r.status === "new").length).toBeLessThanOrEqual(
          1,
        );
      store.close();
      db.close();
    }),
    { numRuns: 40 },
  );
});
