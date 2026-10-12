import { afterEach, expect, test } from "bun:test";
import type { ActionResult, Batch, ProposedAction } from "@kibo/schema";
import { type SignalSetup, signalSetup } from "./service.test-helper";

const setups: SignalSetup[] = [];
const setup = () => {
  const s = signalSetup();
  setups.push(s);
  return s;
};
afterEach(() => {
  for (const s of setups.splice(0)) s.close();
});

const ADAM = { kind: "human" as const, ref: "adam" };

test("a ticket signal is stored, then traced, wakes the project agent and answers honestly", async () => {
  const s = setup();
  const text = await s.service.record(s.ticketRun(), { kind: "ticket", title: "Tests" });
  expect(text).toBe("Signal sig:1 enregistré. Réveil de l'agent de projet demandé (immédiat).");
  const [stored] = s.store.open(s.h.project.id);
  expect(stored).toMatchObject({
    ref: "sig:1",
    runId: "r1",
    runLabel: "opus-dev-2",
    profileName: "opus",
    originTicketId: s.first.id,
    originTicketKey: s.first.key,
    ticketId: s.first.id,
    ticketKey: s.first.key,
    kind: "ticket",
    title: "Tests",
    body: "",
    createdAt: 1_000,
    status: "new",
  });
  expect(s.notes).toEqual([
    {
      runId: "r1",
      data: {
        kind: "signal",
        signalId: stored?.id ?? "",
        ref: "sig:1",
        signalKind: "ticket",
        title: "Tests",
      },
    },
  ]);
  expect(s.order).toEqual(["create", "note"]);
  expect(s.wakes).toEqual([{ projectId: s.h.project.id, kind: "ticket" }]);
  expect(s.emits()).toBe(1);
  expect(s.notices).toEqual([]);
});

test("a blocker on another ticket of the project is scheduled and notified", async () => {
  const s = setup();
  const text = await s.service.record(s.ticketRun(), {
    kind: "blocker",
    title: "Attend le schéma Loro",
    ticket: s.second.key,
  });
  expect(text).toBe(
    "Signal sig:1 enregistré. Réveil de l'agent de projet demandé (prochain réveil possible à 14:41).",
  );
  expect(s.store.open(s.h.project.id)[0]).toMatchObject({
    originTicketKey: s.first.key,
    ticketId: s.second.id,
    ticketKey: s.second.key,
  });
  expect(s.notices).toEqual([
    { title: "Blocage signalé par opus-dev-2", body: `${s.second.key} · Attend le schéma Loro` },
  ]);
});

test("context and questions wait for the next turn without waking anyone", async () => {
  const s = setup();
  expect(await s.service.record(s.ticketRun(), { kind: "context", title: "Ordre gardé" })).toBe(
    "Signal sig:1 enregistré. L'agent de projet le lira à son prochain tour.",
  );
  expect(await s.service.record(s.ticketRun(), { kind: "question", title: "Quel port ?" })).toContain(
    "sig:2",
  );
  expect(s.wakes).toEqual([]);
  expect(s.notices).toEqual([]);
});

test("refusals write nothing and trace nothing", async () => {
  const s = setup();
  const run = s.ticketRun();
  await expect(
    s.service.record(run, { kind: "ticket", title: "T", ticket: "EMIS-99" }),
  ).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  await expect(s.service.record(run, { kind: "ticket", title: "x".repeat(201) })).rejects.toMatchObject({
    code: "INVALID_INPUT",
    detail: expect.stringContaining("title"),
  });
  await expect(s.service.record(run, { kind: "idea", title: "T" })).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  await expect(
    s.service.record(s.ticketRun({ kind: "project" }), { kind: "ticket", title: "T" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    s.service.record(s.ticketRun({ ticketId: null }), { kind: "ticket", title: "T" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(s.store.open(s.h.project.id)).toEqual([]);
  expect(s.notes).toEqual([]);
  expect(s.emits()).toBe(0);
});

test("a run sends twenty signals at most, never twice the same", async () => {
  const s = setup();
  const run = s.ticketRun();
  await s.service.record(run, { kind: "context", title: "Ordre" });
  await expect(s.service.record(run, { kind: "context", title: "Ordre" })).rejects.toMatchObject({
    code: "CONFLICT",
  });
  expect(await s.service.record(s.ticketRun({ id: "r2" }), { kind: "context", title: "Ordre" })).toContain(
    "sig:2",
  );
  for (let i = 1; i < 20; i++) await s.service.record(run, { kind: "context", title: `Point ${i}` });
  await expect(s.service.record(run, { kind: "context", title: "Point 20" })).rejects.toMatchObject({
    code: "QUOTA_EXCEEDED",
  });
  expect(s.store.countByRun("r1")).toBe(20);
});

test("secrets are masked in the stored signal and in the moment", async () => {
  const s = setup();
  await s.service.record(s.ticketRun(), {
    kind: "context",
    title: "Clé ghp_abcdefghijklmnopqrstuvwxyz",
    body: "TOKEN=abc ghp_abcdefghijklmnopqrstuvwxyz",
  });
  const [stored] = s.store.open(s.h.project.id);
  expect(stored?.title).toBe("Clé ‹masqué›");
  expect(stored?.body).toBe("TOKEN=‹masqué› ‹masqué›");
  expect(s.notes[0]?.data).toMatchObject({ title: "Clé ‹masqué›" });
});

test("the box lists every open signal and the twenty last closed ones, newest first, with the wake-up", async () => {
  const s = setup();
  const run = s.ticketRun();
  for (let i = 1; i <= 23; i++)
    await s.service.record(run, { kind: "context", title: `S${i}` }).catch(() => null);
  for (let i = 1; i <= 3; i++)
    await s.service.record(s.ticketRun({ id: "r2" }), { kind: "context", title: `R${i}` });
  const projectId = s.h.project.id;
  for (const signal of s.store.open(projectId).slice(0, 21)) s.service.ignore(projectId, signal.id, ADAM);
  s.store.saveWakeup({ projectId, lastAt: 5, dueAt: 600 });
  const view = s.service.list(projectId);
  expect(view.signals.map((x) => x.ref)).toEqual([
    "sig:23",
    "sig:22",
    ...Array.from({ length: 20 }, (_, i) => `sig:${21 - i}`),
  ]);
  expect(view.wakeup).toEqual({ projectId, lastAt: 5, dueAt: 600 });
  expect(s.service.openCount(projectId)).toBe(2);
  expect(s.service.openRefs(projectId)).toEqual(["sig:22", "sig:23"]);
});

test("ignoring closes a signal of the project, by its author; another project's is not found", async () => {
  const s = setup();
  await s.service.record(s.ticketRun(), { kind: "question", title: "Port ?" });
  const [signal] = s.store.open(s.h.project.id);
  const id = signal?.id ?? "";
  const before = s.emits();
  expect(() => s.service.ignore("other", id, ADAM)).toThrow("NOT_FOUND");
  expect(s.service.ignore(s.h.project.id, id, ADAM)).toMatchObject({
    status: "ignored",
    decidedBy: ADAM,
    batchId: null,
    actionId: null,
    decidedAt: 1_000,
  });
  expect(s.emits()).toBe(before + 1);
});

test("a turn reads the new signals and gets every open one", async () => {
  const s = setup();
  const projectId = s.h.project.id;
  await s.service.record(s.ticketRun(), { kind: "context", title: "A" });
  s.service.markRead(projectId, "pa-1");
  await s.service.record(s.ticketRun(), { kind: "context", title: "B" });
  const open = s.service.markRead(projectId, "pa-2");
  expect(open.map((x) => [x.ref, x.status, x.readRunId])).toEqual([
    ["sig:1", "read", "pa-1"],
    ["sig:2", "read", "pa-2"],
  ]);
  expect(s.store.counts()).toEqual([{ projectId, open: 2, unread: 0 }]);
  expect(s.service.counts()).toEqual(s.store.counts());
});

const action = (p: ProposedAction): ProposedAction => p;
const batchOf = (projectId: string, actions: ProposedAction[]): Batch => ({
  id: "b1",
  projectId,
  runId: "pa-1",
  sessionId: "s",
  seq: 1,
  summary: "Traiter les signaux",
  actions,
  expected: [],
  createdAt: 1,
  status: "applied",
  decidedAt: 2,
  decidedBy: ADAM,
  chosen: null,
  comment: null,
  results: [],
});

test("settling a batch handles the cited signals, ignores the dismissed ones and keeps a closed one", async () => {
  const s = setup();
  const projectId = s.h.project.id;
  for (const title of ["A", "B", "C", "D"]) await s.service.record(s.ticketRun(), { kind: "ticket", title });
  const fourth = s.store.byRef(projectId, "sig:4");
  s.service.ignore(projectId, fourth?.id ?? "", ADAM);
  const batch = batchOf(projectId, [
    action({ id: 1, why: "", type: "createTicket", ref: "new:1", title: "A", signals: ["sig:1", "sig:4"] }),
    action({ id: 2, why: "", type: "createTicket", ref: "new:2", title: "B", signals: ["sig:2"] }),
    action({ id: 3, why: "sans suite", type: "dismissSignal", signal: "sig:3" }),
  ]);
  const results: ActionResult[] = [
    { actionId: 1, outcome: "applied", detail: null, created: { ticketId: "t9", key: "EMIS-3" } },
    { actionId: 2, outcome: "stale", detail: "changé", created: null },
    { actionId: 3, outcome: "applied", detail: null, created: null },
  ];
  const before = s.emits();
  s.service.settle(batch, results, ADAM);
  expect(s.emits()).toBe(before + 1);
  const status = (ref: `sig:${number}`) => s.store.byRef(projectId, ref);
  expect(status("sig:1")).toMatchObject({ status: "handled", batchId: "b1", actionId: 1 });
  expect(status("sig:2")).toMatchObject({ status: "new" });
  expect(status("sig:3")).toMatchObject({ status: "ignored", decidedBy: ADAM, batchId: "b1", actionId: 3 });
  expect(status("sig:4")).toMatchObject({ status: "ignored", batchId: null });
});
