import { describe, expect, test } from "bun:test";
import {
  remoteStatusId,
  type StatusId,
  StatusId as StatusIds,
  type StatusMap,
  type SyncedFields,
} from "@kibo/schema";
import fc from "fast-check";
import {
  canonicalFields,
  normalizeText,
  planSync,
  projectLocal,
  SYNCED_FIELDS,
  settleAfterPush,
} from "./sync-plan";

const f = (patch: Partial<SyncedFields> = {}): SyncedFields => ({
  title: "A",
  description: "",
  statusId: "todo",
  closed: false,
  ...patch,
});

describe("three-way merge, field by field (spec F §5.3)", () => {
  test("nothing changed", () => {
    expect(planSync({ base: f(), local: f(), remote: f() })).toEqual({
      push: {},
      apply: {},
      conflicts: [],
      nextBase: f(),
    });
  });
  test("local only is pushed", () => {
    expect(planSync({ base: f(), local: f({ title: "B" }), remote: f() }).push).toEqual({ title: "B" });
  });
  test("remote only is applied", () => {
    const p = planSync({ base: f(), local: f(), remote: f({ title: "C" }) });
    expect(p.apply).toEqual({ title: "C" });
    expect(p.nextBase.title).toBe("C");
  });
  test("both changed: remote wins and the conflict is reported", () => {
    const p = planSync({ base: f(), local: f({ title: "B" }), remote: f({ title: "C" }) });
    expect(p).toMatchObject({ push: {}, apply: { title: "C" }, conflicts: ["title"] });
  });
  test("both changed to the same value: no conflict", () => {
    const p = planSync({ base: f(), local: f({ title: "B" }), remote: f({ title: "B" }) });
    expect(p).toMatchObject({ push: {}, apply: {}, conflicts: [], nextBase: { title: "B" } });
  });
  test("blocked is never applied from the remote and does not ping-pong", () => {
    const p = planSync({ base: f(), local: f(), remote: f({ statusId: "blocked" }) });
    expect(p.apply).toEqual({});
    expect(p.push).toEqual({});
    expect(p.nextBase.statusId).toBe("todo");
  });
  test("a refused remote status does not reopen nor close on its own", () => {
    const base = f({ statusId: "done", closed: true });
    const p = planSync({ base, local: base, remote: f({ statusId: "blocked" }) });
    expect(p).toEqual({ push: {}, apply: {}, conflicts: [], nextBase: base });
  });
  test("closed is never reported as a conflict on its own", () => {
    const p = planSync({
      base: f(),
      local: f({ statusId: "done", closed: true }),
      remote: f({ statusId: "done", closed: true, title: "Z" }),
    });
    expect(p.conflicts).toEqual([]);
  });
  test("the base is not mutated", () => {
    const base = f();
    planSync({ base, local: f({ title: "B" }), remote: f({ description: "d" }) });
    expect(base).toEqual(f());
    expect(SYNCED_FIELDS).toEqual(["title", "description", "statusId", "closed"]);
  });
});

describe("projection and settle", () => {
  test("without a project only done/open is representable", () => {
    expect(projectLocal({ title: " A ", description: "a\r\nb", statusId: "in_review" }, f(), null)).toEqual(
      f({ title: "A", description: "a\nb" }),
    );
    expect(projectLocal({ title: "A", description: "", statusId: "done" }, f(), null)).toEqual(
      f({ statusId: "done", closed: true }),
    );
  });
  test("an unmapped status keeps the base, including open/closed", () => {
    const map: StatusMap = { todo: "O1" };
    const base = f({ statusId: "done", closed: true });
    expect(projectLocal({ title: "A", description: "", statusId: "blocked" }, base, map)).toEqual(base);
  });
  test("a local status equal to the base stays the base when options are shared", () => {
    const map: StatusMap = { backlog: "O1", todo: "O1" };
    expect(projectLocal({ title: "A", description: "", statusId: "todo" }, f(), map).statusId).toBe("todo");
    expect(projectLocal({ title: "A", description: "", statusId: "in_progress" }, f(), map).statusId).toBe(
      "todo",
    );
  });
  test("a server-normalised pushed value is taken locally instead of re-pushed", () => {
    const p = settleAfterPush({
      base: f(),
      pushed: ["title"],
      returned: f({ title: "B" }),
      local: f({ title: "B " }),
    });
    expect(p.push).toEqual({});
    expect(p.apply).toEqual({ title: "B" });
  });
  test("canonical fields are key-order independent", () => {
    expect(canonicalFields(f())).toBe(
      canonicalFields({ closed: false, statusId: "todo", description: "", title: "A" }),
    );
    expect(normalizeText("a\rb\r\nc")).toBe("a\nb\nc");
  });
});

type Remote = { title: string; description: string | null; closed: boolean; option: string | null };
type Local = { title: string; description: string; statusId: StatusId };
const toFields = (r: Remote, map: StatusMap | null): SyncedFields => {
  const statusId = remoteStatusId(r.closed, r.option, map);
  return {
    title: r.title.trim(),
    description: normalizeText(r.description ?? ""),
    statusId,
    closed: statusId === "done",
  };
};
const pushTo = (r: Remote, patch: Partial<SyncedFields>, map: StatusMap | null): Remote => {
  const option = patch.statusId !== undefined && map !== null ? map[patch.statusId] : undefined;
  return {
    title: patch.title ?? r.title,
    description: patch.description ?? r.description,
    closed: patch.closed ?? r.closed,
    option: option ?? r.option,
  };
};
const applyLocal = (l: Local, apply: Partial<SyncedFields>): Local => ({
  title: apply.title ?? l.title,
  description: apply.description ?? l.description,
  statusId: apply.statusId ?? l.statusId,
});

const statusArb = fc.constantFrom(...StatusIds.options);
const optionArb = fc.constantFrom("O1", "O2", "O3");
const mapArb = fc.option(
  fc.record(
    {
      backlog: optionArb,
      todo: optionArb,
      in_progress: optionArb,
      in_review: optionArb,
      blocked: optionArb,
      done: optionArb,
    },
    { requiredKeys: [] },
  ),
  { nil: null },
);
const remoteArb = fc.record({
  title: fc.constantFrom("a", "b", "c", "a "),
  description: fc.constantFrom<string | null>(null, "", "x", "x\r\ny", "x\ny"),
  closed: fc.boolean(),
  option: fc.option(optionArb, { nil: null }),
});
const localArb = fc.record({
  title: fc.constantFrom("a", "b", "c", " b "),
  description: fc.constantFrom("", "x", "x\ny", "x\r\ny"),
  statusId: statusArb,
});

test("property: after one pull-and-push cycle, the next cycle is a fixed point", () => {
  fc.assert(
    fc.property(mapArb, remoteArb, remoteArb, localArb, (map, origin, remote, local) => {
      const base = toFields(origin, map);
      const p1 = planSync({ base, local: projectLocal(local, base, map), remote: toFields(remote, map) });
      let localNow = applyLocal(local, p1.apply);
      let remoteNow: Remote = remote;
      let baseNow = p1.nextBase;
      const pushed = SYNCED_FIELDS.filter((field) => field in p1.push);
      if (pushed.length > 0) {
        remoteNow = pushTo(remote, p1.push, map);
        const s = settleAfterPush({
          base: p1.nextBase,
          pushed,
          returned: toFields(remoteNow, map),
          local: projectLocal(localNow, p1.nextBase, map),
        });
        expect(s.push).toEqual({});
        localNow = applyLocal(localNow, s.apply);
        baseNow = s.nextBase;
      }
      const p2 = planSync({
        base: baseNow,
        local: projectLocal(localNow, baseNow, map),
        remote: toFields(remoteNow, map),
      });
      expect(p2.push).toEqual({});
      expect(p2.apply).toEqual({});
    }),
    { numRuns: 2000 },
  );
});
