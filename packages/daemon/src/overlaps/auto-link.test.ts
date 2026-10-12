import { afterEach, expect, test } from "bun:test";
import { executeProjectCommand, readProject } from "@kibo/core";
import { KiboError } from "@kibo/schema";
import { cleanupTmp } from "../agents/git-test-kit";
import {
  exporting,
  importing,
  indexedFile,
  type LinkWorldOptions,
  linkWorld,
  NOW,
  P,
  workspaceIndex,
  wsRun,
} from "./auto-link.test-helper";

afterEach(cleanupTmp);

const ADAM = { kind: "human" as const, ref: "Adam" };

function importScene(otherProject = false, opts: LinkWorldOptions = {}) {
  const w = linkWorld(opts);
  const [a, b] = w.tickets;
  if (!a || !b) throw new Error("two tickets expected");
  w.addRun("ra", a);
  w.addRun("rb", b, otherProject ? { projectId: "Q" } : {});
  const ws1 = workspaceIndex("/w/1", [exporting("src/lib/format.ts", ["formatDate"])]);
  const ws2 = workspaceIndex("/w/2", [importing("src/pages/track.ts", "../lib/format", ["formatDate"])]);
  w.probeTable["/w/1"] = {
    "src/pages/track.ts|../lib/format": { path: "src/lib/format.ts", added: true, exports: ["formatDate"] },
  };
  const spaces = [wsRun("/w/1", "ra", NOW - 10), wsRun("/w/2", "rb", NOW)];
  const evaluate = (over = spaces, indexes = [ws1, ws2]) => w.linker.evaluate(P, indexes, over);
  return { ...w, a, b, ws1, ws2, spaces, evaluate };
}

test("an import missing in B and added by A links A blocks B once, with the kibo origin", async () => {
  const s = importScene();
  await s.evaluate();
  expect(s.log).toHaveLength(1);
  expect(s.log[0]).toMatchObject({
    projectId: P,
    command: { method: "addLink", from: s.a.id, to: s.b.id, type: "blocks" },
    meta: { origin: "kibo", instanceId: null },
  });
  const [link] = s.store.autoLink.list(P);
  const added = readProject(s.doc).links.find((l) => l.from === s.a.id && l.to === s.b.id);
  expect(link).toMatchObject({
    linkId: added?.id,
    fromTicketId: s.a.id,
    toTicketId: s.b.id,
    fromTicketKey: s.a.key,
    toTicketKey: s.b.key,
    ownerRunId: "ra",
    otherRunId: "rb",
    reason: "import",
    detail: { path: "src/lib/format.ts", name: "formatDate" },
    status: "added",
  });
  expect(s.moments.map((m) => m.runId)).toEqual(["ra", "rb"]);
  expect(s.moments[0]?.data).toEqual({
    kind: "auto_link",
    autoLinkId: link?.id ?? "",
    fromTicketKey: s.a.key ?? "",
    toTicketKey: s.b.key ?? "",
    reason: "import",
    path: "src/lib/format.ts",
    name: "formatDate",
    failure: null,
  });
  await s.evaluate();
  expect(s.log).toHaveLength(1);
  expect(s.moments).toHaveLength(2);
});

test("a final blocker, a cancelled pair, or two runs of one ticket never link", async () => {
  const done = importScene();
  executeProjectCommand(done.doc, { method: "setStatus", ticketId: done.a.id, statusId: "done" });
  await done.evaluate();
  expect(done.log).toEqual([]);

  const same = importScene();
  same.addRun("rc", same.a);
  await same.evaluate([wsRun("/w/1", "ra"), wsRun("/w/2", "rc")]);
  expect(same.log).toEqual([]);

  const cancelled = importScene();
  await cancelled.evaluate();
  const [link] = cancelled.store.autoLink.list(P);
  cancelled.linker.cancel(link?.id ?? "", ADAM);
  await cancelled.evaluate();
  expect(cancelled.log.map((l) => [l.command.method, l.meta.origin])).toEqual([
    ["addLink", "kibo"],
    ["removeLink", "user"],
  ]);
});

test("a partial index never grounds a link, on either side", async () => {
  for (const side of ["ws1", "ws2"] as const) {
    const s = importScene();
    const indexes = [s.ws1, s.ws2].map((i) => (i === s[side] ? { ...i, partial: true } : i));
    await s.evaluate(s.spaces, indexes);
    expect(s.log).toEqual([]);
    expect(s.moments).toEqual([]);
  }
});

test("a run of another project is never linked", async () => {
  const s = importScene(true);
  await s.evaluate();
  expect(s.log).toEqual([]);
});

test("a cycle writes one failure moment in both runs and no row, never repeated", async () => {
  const s = importScene();
  executeProjectCommand(s.doc, { method: "addLink", from: s.b.id, to: s.a.id, type: "blocks" });
  await s.evaluate();
  await s.evaluate();
  expect(s.store.autoLink.list(P)).toEqual([]);
  expect(s.moments.map((m) => [m.runId, m.data.kind === "auto_link" && m.data.failure])).toEqual([
    ["ra", "cycle"],
    ["rb", "cycle"],
  ]);
  expect(s.moments[0]?.data).toMatchObject({ autoLinkId: null, reason: "import" });
});

test("a cycle refused by the doc itself is reported the same way, never thrown", async () => {
  const s = importScene(false, {
    refuse: () => {
      throw new KiboError("LINK_CYCLE", "this dependency would create a cycle");
    },
  });
  await s.evaluate();
  expect(s.log).toHaveLength(1);
  expect(s.store.autoLink.list(P)).toEqual([]);
  expect(s.moments.map((m) => m.data.kind === "auto_link" && m.data.failure)).toEqual(["cycle", "cycle"]);
});

test("any other refusal of the doc is not swallowed", async () => {
  const s = importScene(false, {
    refuse: () => {
      throw new KiboError("FORBIDDEN", "read-only project");
    },
  });
  await expect(s.evaluate()).rejects.toThrow("read-only project");
});

test("a copy after a settled export overlap links the owner first", async () => {
  const w = linkWorld();
  const [a, b] = w.tickets;
  if (!a || !b) throw new Error("two tickets expected");
  w.addRun("ra", a);
  w.addRun("rb", b);
  const created = w.store.create(
    {
      kind: "export",
      key: "export:formatDate",
      ownerWorkspace: "/w/2",
      otherWorkspace: "/w/1",
      ownerRunId: "rb",
      otherRunId: "ra",
      detail: {
        kind: "export",
        name: "formatDate",
        ownerPath: "src/lib/format.ts",
        otherPath: "src/utils/date.ts",
      },
    },
    P,
    NOW - 5,
  );
  w.store.event(created.id, { type: "resolved", role: null, by: null, at: NOW - 1 });
  const copy = indexedFile("src/lib/format.ts", { hash: "h1" });
  await w.linker.evaluate(
    P,
    [workspaceIndex("/w/1", [copy]), workspaceIndex("/w/2", [copy])],
    [wsRun("/w/1", "ra", NOW - 10), wsRun("/w/2", "rb", NOW)],
  );
  expect(w.log.map((l) => l.command)).toEqual([{ method: "addLink", from: b.id, to: a.id, type: "blocks" }]);
  expect(w.store.autoLink.list(P)[0]).toMatchObject({
    reason: "copy",
    detail: { path: "src/lib/format.ts", name: null },
  });
});

test("cancel removes the link as the user and records who; a second cancel changes nothing", async () => {
  const s = importScene();
  await s.evaluate();
  const [link] = s.store.autoLink.list(P);
  const cancelled = s.linker.cancel(link?.id ?? "", ADAM);
  expect(cancelled).toMatchObject({ status: "cancelled", cancelledBy: ADAM, cancelledAt: NOW });
  expect(readProject(s.doc).links).toEqual([]);
  expect(s.linker.cancel(link?.id ?? "", ADAM).status).toBe("cancelled");
  expect(s.log.filter((l) => l.command.method === "removeLink")).toHaveLength(1);
  expect(s.moments).toHaveLength(2);
  expect(() => s.linker.cancel("nope", ADAM)).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
});

test("a link removed by hand becomes removed and is never added again", async () => {
  const s = importScene();
  await s.evaluate();
  const [link] = s.store.autoLink.list(P);
  executeProjectCommand(s.doc, { method: "removeLink", linkId: link?.linkId ?? "" });
  s.linker.reconcileRemoved(P);
  expect(s.store.autoLink.get(link?.id ?? "")?.status).toBe("removed");
  await s.evaluate();
  expect(s.log).toHaveLength(1);
  expect(s.linker.cancel(link?.id ?? "", ADAM).status).toBe("removed");
});
