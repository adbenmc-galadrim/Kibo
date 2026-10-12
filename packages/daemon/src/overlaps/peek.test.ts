import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Overlap, PeekFileResult, PeekWorkResult } from "@kibo/schema";
import { cleanupTmp, commit, git, repo } from "../agents/git-test-kit";
import { createPeek } from "./peek";
import {
  type FakeWorld,
  fakeServices,
  HOUR,
  indexedFile,
  NOW,
  screenOf,
  ticketRun,
  workspaceIndex,
  worktree,
} from "./peek-fakes.test-helper";

afterEach(cleanupTmp);

const caller = ticketRun("r15", "BOU-15");
const active = ticketRun("r12", "BOU-12", { createdAt: NOW - HOUR });
const older = ticketRun("r12-old", "BOU-12", {
  createdAt: NOW - 5 * HOUR,
  state: "done",
  endedAt: NOW - 4 * HOUR,
});
const recent = ticketRun("r13", "BOU-13", { state: "done", endedAt: NOW - 2 * HOUR });
const stale = ticketRun("r14", "BOU-14", { state: "done", endedAt: NOW - 25 * HOUR });
const foreign = ticketRun("rq", "QUX-1", { projectId: "Q" });
const projectRun = ticketRun("rp", "BOU-0", { kind: "project", ticketId: null, ticketKey: null });

const overlap = (id: string, ownerRunId: string, otherRunId: string): Overlap => ({
  id,
  projectId: "P",
  kind: "file",
  key: "src/i18n/fr.ts",
  ownerRunId,
  otherRunId,
  ownerWorkspace: "/a",
  otherWorkspace: "/b",
  detail: { kind: "file", path: "src/i18n/fr.ts" },
  firstSeenAt: NOW,
  lastSeenAt: NOW,
  status: "open",
  deliveredAt: null,
  ownerDeliveredAt: null,
  resolvedAt: null,
  ignoredBy: null,
  ignoredAt: null,
});

async function world(over: Partial<FakeWorld> = {}) {
  const dir = realpathSync(await repo());
  mkdirSync(join(dir, "src", "lib"), { recursive: true });
  writeFileSync(join(dir, "src", "lib", "format.ts"), "export const a = 1;\n");
  await git(["add", "."], dir);
  await git([...commit, "-m", "base"], dir);
  const base = await git(["rev-parse", "HEAD"], dir);
  writeFileSync(
    join(dir, "src", "lib", "format.ts"),
    "export const a = 1;\nexport function formatDate() {}\n",
  );
  writeFileSync(join(dir, "src", "new.ts"), "export const fresh = 2;\n");
  const space = { ...worktree(dir, base), worktreeName: "bou-12" };
  const services = fakeServices({
    runs: [caller, active, older, recent, stale, foreign, projectRun],
    spaces: {
      r15: worktree("/w/bou-15"),
      r12: space,
      "r12-old": space,
      r13: worktree("/w/bou-13"),
      r14: worktree("/w/bou-14"),
      rq: worktree("/w/qux-1"),
    },
    indexes: {
      [dir]: workspaceIndex(dir, [
        indexedFile("src/lib/format.ts", { status: "modified", added: 1, exports: ["formatDate"] }),
        indexedFile("src/new.ts", { added: 1, exports: ["fresh"] }),
      ]),
      "/w/bou-13": workspaceIndex("/w/bou-13", []),
    },
    plans: { "t-BOU-12": [{ id: "a", title: "Dates", status: "doing", note: null }] },
    overlaps: [overlap("o1", "r12", "r15"), overlap("o2", "r13", "r16")],
    screen: screenOf({ ".env": "secret" }),
    ...over,
  });
  return { dir, peek: createPeek(services) };
}

const notFound = async (call: Promise<string>) => {
  await expect(call).rejects.toMatchObject({ code: "NOT_FOUND" });
  return call.catch((e: Error) => e.message);
};

describe("peek_work without a path", () => {
  test("a ticket key gives its last run, its plan, files and open overlaps with the caller", async () => {
    const { peek } = await world();
    const result: PeekWorkResult = JSON.parse(await peek.call(caller, { run: "BOU-12" }));
    expect(result).toEqual({
      run: {
        id: "r12",
        name: "bou · livraison · BOU-12",
        ticketKey: "BOU-12",
        ticketTitle: "Ticket BOU-12",
        state: "running",
        startedAt: NOW - HOUR,
        workspace: "worktree",
      },
      plan: [{ id: "a", title: "Dates", status: "doing", note: null }],
      files: [
        { path: "src/lib/format.ts", status: "modified", added: 1, removed: 0, exports: ["formatDate"] },
        { path: "src/new.ts", status: "added", added: 1, removed: 0, exports: ["fresh"] },
      ],
      truncated: false,
      overlaps: [overlap("o1", "r12", "r15")],
    });
  });

  test("a run id of a run ended less than a day ago is found", async () => {
    const { peek } = await world();
    expect(JSON.parse(await peek.call(caller, { run: "r13" })).run.id).toBe("r13");
  });

  test("an old run, a foreign run and an unknown run are all just not found", async () => {
    const { peek } = await world();
    const unknown = await notFound(peek.call(caller, { run: "ZZZ-1" }));
    const quiet = (run: string) => unknown.replace("ZZZ-1", run);
    expect(await notFound(peek.call(caller, { run: "BOU-14" }))).toBe(quiet("BOU-14"));
    expect(await notFound(peek.call(caller, { run: "rq" }))).toBe(quiet("rq"));
    expect(await notFound(peek.call(caller, { run: "QUX-1" }))).toBe(quiet("QUX-1"));
    expect(await notFound(peek.call(caller, { run: "rp" }))).toBe(quiet("rp"));
  });

  test("a run whose workspace is gone is not found", async () => {
    const { peek } = await world({ spaces: {} });
    await notFound(peek.call(caller, { run: "BOU-12" }));
  });

  test("files beyond 500 are cut and flagged", async () => {
    const files = Array.from({ length: 501 }, (_, i) => indexedFile(`src/f${i}.ts`));
    const { peek } = await world({
      spaces: { r12: worktree("/w/bou-12") },
      indexes: { "/w/bou-12": workspaceIndex("/w/bou-12", files) },
    });
    const result: PeekWorkResult = JSON.parse(await peek.call(caller, { run: "BOU-12" }));
    expect(result.files).toHaveLength(500);
    expect(result.truncated).toBe(true);
  });

  test("an invalid input is refused", async () => {
    const { peek } = await world();
    await expect(peek.call(caller, { path: "x" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(peek.call(caller, "BOU-12")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("peek_work with a path", () => {
  test("a changed file comes with its content and its diff against the base", async () => {
    const { peek } = await world();
    const result: PeekFileResult = JSON.parse(
      await peek.call(caller, { run: "BOU-12", path: "src/lib/format.ts" }),
    );
    expect(result.path).toBe("src/lib/format.ts");
    expect(result.status).toBe("modified");
    expect(result.content).toBe("export const a = 1;\nexport function formatDate() {}\n");
    expect(result.diff).toContain("+export function formatDate() {}");
    expect(result.diff).toContain("--- a/src/lib/format.ts");
    expect(result.truncated).toBe(false);
  });

  test("an untracked file has its whole content as added lines", async () => {
    const { peek } = await world();
    const result: PeekFileResult = JSON.parse(await peek.call(caller, { run: "BOU-12", path: "src/new.ts" }));
    expect(result.status).toBe("added");
    expect(result.diff).toBe("--- /dev/null\n+++ b/src/new.ts\n+export const fresh = 2;\n");
  });

  test("a long diff is cut at 64 KiB", async () => {
    const { dir, peek } = await world();
    writeFileSync(join(dir, "src", "lib", "format.ts"), `${"export const line = 1;\n".repeat(4_000)}`);
    const result: PeekFileResult = JSON.parse(
      await peek.call(caller, { run: "BOU-12", path: "src/lib/format.ts" }),
    );
    expect(result.diff.length).toBeLessThanOrEqual(65_536);
    expect(result.truncated).toBe(true);
  });

  test("a bad path is refused with its reason", async () => {
    const { peek } = await world();
    await expect(peek.call(caller, { run: "BOU-12", path: "../x" })).rejects.toThrow(
      "hors de l'espace de travail",
    );
    await expect(peek.call(caller, { run: "BOU-12", path: ".env" })).rejects.toThrow("fichier secret");
    await expect(peek.call(caller, { run: "BOU-12", path: "src/missing.ts" })).rejects.toThrow(
      "fichier introuvable",
    );
  });
});

describe("quota", () => {
  test("200 calls per turn, then QUOTA_EXCEEDED until the next turn", async () => {
    const { peek } = await world({
      spaces: { r12: worktree("/w/bou-12"), r15: worktree("/w/bou-15") },
      indexes: { "/w/bou-12": workspaceIndex("/w/bou-12", []) },
    });
    for (let i = 0; i < 200; i++) await peek.call(caller, { run: "BOU-12" });
    await expect(peek.call(caller, { run: "BOU-12" })).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
    expect(JSON.parse(await peek.call(active, { run: "BOU-15" })).run.id).toBe("r15");
    peek.resetQuota("r15");
    expect(JSON.parse(await peek.call(caller, { run: "BOU-12" })).run.id).toBe("r12");
  });
});
