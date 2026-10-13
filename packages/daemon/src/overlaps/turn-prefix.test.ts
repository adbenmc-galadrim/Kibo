import { describe, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { composeWorkSection } from "@kibo/core/overlaps/section";
import type { ParallelRun, ParallelWork } from "@kibo/schema";
import { NOW, ticketRun } from "./peek-fakes.test-helper";
import { createTurnPrefixer } from "./turn-prefix";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const me = ticketRun("r15", "BOU-15");

const peer = (files: string[]): ParallelRun => ({
  runId: "r12",
  name: "bou · livraison · BOU-12",
  ticketKey: "BOU-12",
  ticketTitle: "Dates",
  startedAt: NOW - 60_000,
  step: null,
  plan: null,
  files: files.map((path) => ({ path, status: "added", added: 1, removed: 0 })),
  exports: [],
  workspace: "worktree",
  worktreeName: "bou-12",
  truncated: false,
});

function harness(initial: ParallelWork) {
  let work = initial;
  let now = NOW;
  const prefixer = createTurnPrefixer({ parallelWork: async () => work, hash, now: () => now });
  return {
    prefixer,
    set: (next: ParallelWork) => {
      work = next;
    },
    tick: (ms: number) => {
      now += ms;
    },
  };
}

const workOf = (...files: string[]): ParallelWork => ({
  runs: [peer(files)],
  more: 0,
  overlaps: [],
  partial: false,
});
const NONE: ParallelWork = { runs: [], more: 0, overlaps: [], partial: false };

describe("createTurnPrefixer", () => {
  test("the first turn gets the section for the brief, the next unchanged turn only the answer", async () => {
    const h = harness(workOf("src/a.ts"));
    expect(await h.prefixer.briefSection(me)).toBe(composeWorkSection(workOf("src/a.ts"), NOW));
    h.tick(5 * 60_000);
    expect(await h.prefixer.prompt(me, "Port 8080")).toBe("Port 8080");
  });

  test("a changed section is put before the answer and remembered", async () => {
    const h = harness(workOf("src/a.ts"));
    await h.prefixer.briefSection(me);
    h.set(workOf("src/a.ts", "src/b.ts"));
    const section = composeWorkSection(workOf("src/a.ts", "src/b.ts"), NOW) ?? "";
    expect(await h.prefixer.prompt(me, "Port 8080")).toBe(`${section}\n\n# Message\n\nPort 8080`);
    expect(await h.prefixer.prompt(me, "Encore")).toBe("Encore");
  });

  test("an empty answer with a changed section gives the section alone", async () => {
    const h = harness(NONE);
    expect(await h.prefixer.briefSection(me)).toBeNull();
    h.set(workOf("src/a.ts"));
    expect(await h.prefixer.prompt(me, "")).toBe(composeWorkSection(workOf("src/a.ts"), NOW) ?? "");
  });

  test("a section that disappears adds nothing", async () => {
    const h = harness(workOf("src/a.ts"));
    await h.prefixer.briefSection(me);
    h.set(NONE);
    expect(await h.prefixer.prompt(me, "Suite")).toBe("Suite");
  });

  test("a forgotten run gets the section again", async () => {
    const h = harness(workOf("src/a.ts"));
    await h.prefixer.briefSection(me);
    h.prefixer.forget(me.id);
    expect(await h.prefixer.prompt(me, "Suite")).toStartWith("## Travail en cours sur le projet");
  });

  test("a failing view never blocks the turn", async () => {
    const errors = spyOn(console, "error").mockImplementation(() => {});
    try {
      const prefixer = createTurnPrefixer({
        parallelWork: async () => {
          throw new Error("git gone");
        },
        hash,
        now: () => NOW,
      });
      expect(await prefixer.briefSection(me)).toBeNull();
      expect(await prefixer.prompt(me, "Suite")).toBe("Suite");
      expect(errors.mock.calls.some((c) => String(c[0]).includes("work in progress"))).toBe(true);
    } finally {
      errors.mockRestore();
    }
  });
});

test("the brief always carries the current section, a later turn only a changed one", async () => {
  const h = harness(workOf("src/a.ts"));
  const first = await h.prefixer.briefSection(me);
  expect(await h.prefixer.briefSection(me)).toBe(first);
  expect(await h.prefixer.changedSection(me)).toBeNull();
  h.set(workOf("src/b.ts"));
  expect(await h.prefixer.changedSection(me)).toBe(composeWorkSection(workOf("src/b.ts"), NOW));
});
