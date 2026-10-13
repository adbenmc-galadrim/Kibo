import { describe, expect, test } from "bun:test";
import { type Overlap, type OverlapDetail, overlapKey } from "@kibo/schema";
import { reconcile } from "./lifecycle";
import type { Finding } from "./roles";

const exportDetail: OverlapDetail = {
  kind: "export",
  name: "formatDate",
  ownerPath: "src/lib/format.ts",
  otherPath: "src/utils/date.ts",
};

const finding = (patch: Partial<Finding> = {}): Finding => ({
  kind: "export",
  key: overlapKey("export", "formatDate"),
  ownerWorkspace: "ws1",
  otherWorkspace: "ws2",
  ownerRunId: "r1",
  otherRunId: "r2",
  detail: exportDetail,
  ...patch,
});

const open = (id: string, f: Finding, status: Overlap["status"] = "open"): Overlap => ({
  ...f,
  id,
  projectId: "p",
  firstSeenAt: 1,
  lastSeenAt: 1,
  status,
  deliveredAt: null,
  ownerDeliveredAt: null,
  resolvedAt: null,
  ignoredBy: null,
  ignoredAt: null,
});

const none = new Set<string>();
const sweep = { kind: "sweep" } as const;
const fileFinding = finding({
  kind: "file",
  key: "file:src/a.ts",
  detail: { kind: "file", path: "src/a.ts" },
});

describe("reconcile", () => {
  test("a new finding is created", () => {
    expect(reconcile([], [finding()], none, sweep)).toEqual({ create: [finding()], resolve: [], touch: [] });
  });

  test("an open pair is only touched", () => {
    expect(reconcile([open("o1", finding())], [finding()], none, sweep)).toEqual({
      create: [],
      resolve: [],
      touch: ["o1"],
    });
  });

  test("the pair matches with the roles swapped", () => {
    const swapped = finding({
      ownerWorkspace: "ws2",
      otherWorkspace: "ws1",
      ownerRunId: "r2",
      otherRunId: "r1",
    });
    expect(reconcile([open("o1", finding())], [swapped], none, sweep).touch).toEqual(["o1"]);
  });

  test("a sweep resolves what it no longer sees", () => {
    expect(reconcile([open("o1", finding())], [], none, sweep)).toEqual({
      create: [],
      resolve: ["o1"],
      touch: [],
    });
  });

  test("a file check resolves only the overlaps citing that file on the writer side", () => {
    const o1 = open("o1", fileFinding);
    expect(reconcile([o1], [], none, { kind: "file", workspace: "ws1", path: "src/a.ts" }).resolve).toEqual([
      "o1",
    ]);
    expect(reconcile([o1], [], none, { kind: "file", workspace: "ws1", path: "src/b.ts" }).resolve).toEqual(
      [],
    );
    expect(reconcile([o1], [], none, { kind: "file", workspace: "ws9", path: "src/a.ts" }).resolve).toEqual(
      [],
    );
  });

  test("a file check resolves an export whose path is on the writer side", () => {
    const o1 = open("o1", finding());
    const onOther = { kind: "file", workspace: "ws2", path: "src/utils/date.ts" } as const;
    expect(reconcile([o1], [], none, onOther).resolve).toEqual(["o1"]);
    const wrongSide = { kind: "file", workspace: "ws1", path: "src/utils/date.ts" } as const;
    expect(reconcile([o1], [], none, wrongSide).resolve).toEqual([]);
  });

  test("an ignored key is neither created nor touched", () => {
    const ignored = new Set([overlapKey("export", "formatDate")]);
    expect(reconcile([], [finding()], ignored, sweep).create).toEqual([]);
    expect(reconcile([open("o1", finding())], [finding()], ignored, sweep).touch).toEqual([]);
  });

  test("closed overlaps are not open ones", () => {
    const closed = open("o1", finding(), "resolved");
    expect(reconcile([closed], [finding()], none, sweep)).toEqual({
      create: [finding()],
      resolve: [],
      touch: [],
    });
    expect(reconcile([closed], [], none, sweep).resolve).toEqual([]);
  });

  test("a finding coming back after its resolution is created again", () => {
    expect(reconcile([], [finding()], none, sweep).create).toHaveLength(1);
  });

  test("the same key on another pair is created apart", () => {
    const elsewhere = finding({ otherWorkspace: "ws3", otherRunId: "r3" });
    expect(reconcile([open("o1", finding())], [finding(), elsewhere], none, sweep)).toEqual({
      create: [elsewhere],
      resolve: [],
      touch: ["o1"],
    });
  });

  test("duplicate findings are created once", () => {
    expect(reconcile([], [finding(), finding()], none, sweep).create).toHaveLength(1);
  });
});
