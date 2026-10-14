import { describe, expect, test } from "bun:test";
import type { Overlap } from "@kibo/schema";
import {
  fakeServices,
  HOUR,
  indexedFile,
  NOW,
  ticketRun,
  workspaceIndex,
  worktree,
} from "./peek-fakes.test-helper";
import { createWorkView } from "./work-view";

const me = ticketRun("r15", "BOU-15", { startedAt: NOW - HOUR / 2 });
const other = ticketRun("r12", "BOU-12", { startedAt: NOW - HOUR });

const overlap: Overlap = {
  id: "o1",
  projectId: "P",
  kind: "export",
  key: "formatDate",
  ownerRunId: "r12",
  otherRunId: "r15",
  ownerWorkspace: "/w/bou-12",
  otherWorkspace: "/w/bou-15",
  detail: {
    kind: "export",
    name: "formatDate",
    ownerPath: "src/lib/format.ts",
    otherPath: "src/utils/date.ts",
  },
  firstSeenAt: NOW,
  lastSeenAt: NOW,
  status: "open",
  deliveredAt: null,
  ownerDeliveredAt: null,
  resolvedAt: null,
  ignoredBy: null,
  ignoredAt: null,
};

describe("parallelWork", () => {
  test("lists the other active ticket runs of the project with their index", async () => {
    const services = fakeServices({
      runs: [
        me,
        other,
        ticketRun("rq", "QUX-1", { projectId: "Q" }),
        ticketRun("rd", "BOU-9", { state: "done", endedAt: NOW - 1 }),
        ticketRun("rp", "BOU-0", { kind: "project", ticketId: null, ticketKey: null }),
      ],
      spaces: { r15: worktree("/w/bou-15"), r12: worktree("/w/bou-12") },
      indexes: {
        "/w/bou-12": workspaceIndex("/w/bou-12", [
          indexedFile("src/lib/format.ts", { added: 42, exports: ["formatDate"] }),
          indexedFile("src/i18n/fr.ts", { status: "modified", added: 3, removed: 1 }),
        ]),
      },
      plans: { "t-BOU-12": [{ id: "a", title: "Écrire les tests", status: "doing", note: null }] },
      overlaps: [overlap, { ...overlap, id: "o2", status: "resolved" }],
    });
    const work = await createWorkView(services).parallelWork(me);
    expect(work).toEqual({
      runs: [
        {
          runId: "r12",
          name: "bou · livraison · BOU-12",
          ticketKey: "BOU-12",
          ticketTitle: "Ticket BOU-12",
          startedAt: NOW - HOUR,
          step: "Écrire les tests",
          plan: [{ id: "a", title: "Écrire les tests", status: "doing", note: null }],
          files: [
            { path: "src/lib/format.ts", status: "added", added: 42, removed: 0 },
            { path: "src/i18n/fr.ts", status: "modified", added: 3, removed: 1 },
          ],
          exports: [{ name: "formatDate", path: "src/lib/format.ts" }],
          workspace: "worktree",
          worktreeName: "bou-12",
          truncated: false,
        },
      ],
      more: 0,
      overlaps: [overlap],
      partial: false,
      sharedPaths: [],
    });
    expect(services.indexed).toEqual([["r12"], ["r15"]]);
  });

  test("the paths changed by the caller and another run are given for the page of the run", async () => {
    const services = fakeServices({
      runs: [me, other],
      spaces: { r15: worktree("/w/bou-15"), r12: worktree("/w/bou-12") },
      indexes: {
        "/w/bou-12": workspaceIndex("/w/bou-12", [
          indexedFile("src/lib/format.ts"),
          indexedFile("src/i18n/fr.ts"),
        ]),
        "/w/bou-15": workspaceIndex("/w/bou-15", [
          indexedFile("src/i18n/fr.ts"),
          indexedFile("src/utils/date.ts"),
        ]),
      },
    });
    expect((await createWorkView(services).parallelWork(me)).sharedPaths).toEqual(["src/i18n/fr.ts"]);
  });

  test("no path is in common without a workspace of the caller or without files elsewhere", async () => {
    const indexes = {
      "/w/bou-12": workspaceIndex("/w/bou-12", [indexedFile("src/i18n/fr.ts")]),
      "/w/bou-15": workspaceIndex("/w/bou-15", [indexedFile("src/i18n/fr.ts")]),
    };
    const homeless = fakeServices({ runs: [me, other], spaces: { r12: worktree("/w/bou-12") }, indexes });
    expect((await createWorkView(homeless).parallelWork(me)).sharedPaths).toEqual([]);
    const alone = fakeServices({ runs: [me], spaces: { r15: worktree("/w/bou-15") }, indexes });
    expect((await createWorkView(alone).parallelWork(me)).sharedPaths).toEqual([]);
    expect(alone.indexed).toEqual([]);
  });

  test("a run in the same workspace is shared and never shows its files", async () => {
    const twin = ticketRun("r16", "BOU-16", { cwd: "/w/bou-15" });
    const services = fakeServices({
      runs: [me, twin],
      spaces: { r15: worktree("/w/bou-15"), r16: worktree("/w/bou-15") },
      indexes: { "/w/bou-15": workspaceIndex("/w/bou-15", [indexedFile("src/a.ts")]) },
    });
    const [run] = (await createWorkView(services).parallelWork(me)).runs;
    expect(run).toMatchObject({ runId: "r16", workspace: "shared", files: [], exports: [] });
    expect(services.indexed).toEqual([]);
  });

  test("an isolated run is listed without files and is not a partial detection", async () => {
    const isolated = ticketRun("r17", "BOU-17", { workspace: "isolated" });
    const work = await createWorkView(
      fakeServices({ runs: [me, isolated], spaces: { r15: worktree("/w/bou-15") } }),
    ).parallelWork(me);
    expect(work.runs[0]).toMatchObject({ workspace: "isolated", files: [], worktreeName: null });
    expect(work.partial).toBe(false);
  });

  test("an index that cannot be read makes the detection partial", async () => {
    const services = fakeServices({
      runs: [me, other],
      spaces: { r15: worktree("/w/bou-15"), r12: worktree("/w/bou-12") },
    });
    const work = await createWorkView(services).parallelWork(me);
    expect(work.partial).toBe(true);
    expect(work.runs[0]).toMatchObject({ files: [], workspace: "worktree" });
    const gone = await createWorkView(fakeServices({ runs: [me, other], spaces: {} })).parallelWork(me);
    expect(gone.partial).toBe(true);
  });

  test("a partial or truncated index is carried over", async () => {
    const services = fakeServices({
      runs: [me, other],
      spaces: { r12: worktree("/w/bou-12") },
      indexes: { "/w/bou-12": workspaceIndex("/w/bou-12", [], { truncated: true, partial: true }) },
    });
    const work = await createWorkView(services).parallelWork(me);
    expect(work.partial).toBe(true);
    expect(work.runs[0]?.truncated).toBe(true);
  });

  test("eight runs at most, the oldest first, the rest counted", async () => {
    const others = Array.from({ length: 10 }, (_, i) =>
      ticketRun(`o${i}`, `BOU-${20 + i}`, { startedAt: NOW - (i + 1) * HOUR, workspace: "isolated" }),
    );
    const work = await createWorkView(fakeServices({ runs: [me, ...others] })).parallelWork(me);
    expect(work.runs.map((r) => r.runId)).toEqual(["o9", "o8", "o7", "o6", "o5", "o4", "o3", "o2"]);
    expect(work.more).toBe(2);
  });

  test("a run without a project sees nothing", async () => {
    const task = ticketRun("t", "BOU-1", { projectId: null });
    expect(await createWorkView(fakeServices({ runs: [task, other] })).parallelWork(task)).toEqual({
      runs: [],
      more: 0,
      overlaps: [],
      partial: false,
      sharedPaths: [],
    });
  });
});
