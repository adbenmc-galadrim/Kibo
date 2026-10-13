import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { DUPLICATION_LIMITS, hasSecret, type ParallelRun, type ParallelWork } from "@kibo/schema";
import fc from "fast-check";
import { composeWorkSection, sectionFingerprint } from "./section";

const NOW = 2_000_000_000;
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

const secret = fc.oneof(
  fc.constant(`ghp_${"b".repeat(24)}`),
  fc.constant(`sk-${"c".repeat(20)}`),
  fc.constant("AKIAABCDEFGHIJKLMNOP"),
  fc.constant(`xoxb-${"1".repeat(12)}`),
  fc.constant("API_TOKEN=hunter2"),
);

const text = fc.oneof(fc.string({ maxLength: 60 }), secret);

const file = fc.record({
  path: fc.oneof(fc.stringMatching(/^[a-z]{1,20}\/[a-z]{1,30}\.ts$/), secret),
  status: fc.constantFrom("added" as const, "modified" as const, "deleted" as const, "renamed" as const),
  added: fc.nat(10_000),
  removed: fc.nat(10_000),
});

const parallelRun: fc.Arbitrary<ParallelRun> = fc.record({
  runId: fc.uuid(),
  name: text,
  ticketKey: fc.stringMatching(/^[A-Z]{3}-[0-9]{1,3}$/),
  ticketTitle: text,
  startedAt: fc.integer({ min: NOW - 86_400_000, max: NOW }),
  step: fc.option(text),
  plan: fc.option(
    fc.array(
      fc.record({
        id: fc.string({ minLength: 1, maxLength: 5 }),
        title: text,
        status: fc.constantFrom("todo" as const, "doing" as const, "done" as const, "blocked" as const),
        note: fc.constant(null),
      }),
      { maxLength: 35 },
    ),
  ),
  files: fc.array(file, { maxLength: 60 }),
  exports: fc.array(fc.record({ name: text, path: text }), { maxLength: 50 }),
  workspace: fc.constantFrom("worktree" as const, "repo" as const, "shared" as const, "isolated" as const),
  worktreeName: fc.option(text),
  truncated: fc.boolean(),
});

const parallelWork: fc.Arbitrary<ParallelWork> = fc.record({
  runs: fc.array(parallelRun, { maxLength: 12 }),
  more: fc.nat(20),
  overlaps: fc.constant([]),
  partial: fc.boolean(),
});

test("the section never exceeds its bound and never leaks a secret", () => {
  fc.assert(
    fc.property(parallelWork, (work) => {
      const section = composeWorkSection(work, NOW);
      if (section === null) return;
      expect(section.length).toBeLessThanOrEqual(DUPLICATION_LIMITS.sectionChars);
      expect(hasSecret(section)).toBe(false);
    }),
    { numRuns: 150 },
  );
});

test("the order of files does not change the fingerprint", () => {
  fc.assert(
    fc.property(parallelWork, fc.nat(), (work, seed) => {
      const shuffled: ParallelWork = {
        ...work,
        runs: work.runs.map((r) => ({
          ...r,
          files: [...r.files].sort(
            (a, b) => ((a.path.length * 31 + seed) % 7) - ((b.path.length * 31 + seed) % 7),
          ),
        })),
      };
      expect(sectionFingerprint(composeWorkSection(shuffled, NOW), hash)).toBe(
        sectionFingerprint(composeWorkSection(work, NOW), hash),
      );
    }),
    { numRuns: 100 },
  );
});
