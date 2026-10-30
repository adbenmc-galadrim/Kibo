import { expect, test } from "bun:test";
import type { Ticket } from "@kibo/schema";
import { createProjectDoc, executeProjectCommand, readProject } from "./index";

const TODAY = "2026-10-16";
const MINIO = "Serveur MinIO de recette indisponible";

const newDoc = () =>
  createProjectDoc({
    id: "p1",
    key: "SILO",
    name: "Silo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  });
type Doc = ReturnType<typeof newDoc>;

const run = (d: Doc, cmd: Parameters<typeof executeProjectCommand>[1]) => executeProjectCommand(d, cmd);
const create = (d: Doc, title: string, parentId?: string) =>
  run(d, { method: "createTicket", title, parentId, feature: parentId === undefined }) as Ticket;
const keyOf = (t: Ticket): string => t.key ?? t.id;
const view = (d: Doc, id: string) => {
  const t = readProject(d, TODAY).tickets.find((x) => x.id === id);
  if (!t) throw new Error(`missing ${id}`);
  return t;
};

const f5 = () => {
  const d = newDoc();
  const root = create(d, "Envoi hors ligne");
  const [s31, s32, s33, s34, s35] = ["31", "32", "33", "34", "35"].map((n) =>
    create(d, `Étape ${n}`, root.id),
  );
  if (!s31 || !s32 || !s33 || !s34 || !s35) throw new Error("missing steps");
  run(d, { method: "setStatus", ticketId: s31.id, statusId: "done" });
  run(d, { method: "setStatus", ticketId: s32.id, statusId: "in_review" });
  run(d, { method: "setStatus", ticketId: s33.id, statusId: "in_progress" });
  run(d, { method: "addLink", from: s33.id, to: s34.id, type: "blocks" });
  run(d, { method: "addLink", from: s34.id, to: s35.id, type: "blocks" });
  return { d, root, s31, s32, s33, s34, s35 };
};

test("setHold goes through the command path and leaves the status alone", () => {
  const { d, s33 } = f5();
  const held = run(d, { method: "setHold", ticketId: s33.id, reason: MINIO, since: TODAY }) as Ticket;
  expect(held.hold).toEqual({ reason: MINIO, since: TODAY });
  expect(view(d, s33.id).statusId).toBe("in_progress");
});

test("the views carry the own hold and the hold by dependency", () => {
  const { d, s33, s34, s35, s32 } = f5();
  run(d, { method: "setHold", ticketId: s33.id, reason: MINIO, since: TODAY });
  const own = { reason: MINIO, since: TODAY, key: keyOf(s33) };
  expect(view(d, s33.id).onHold).toEqual({ source: "own", ...own });
  expect(view(d, s34.id).onHold).toEqual({ source: "dependency", ...own });
  expect(view(d, s35.id).onHold).toEqual({ source: "dependency", ...own });
  expect(view(d, s32.id).onHold).toBeNull();
});

test("a step waiting for a step on hold is not startable for that reason, its blockers unchanged", () => {
  const { d, s33, s34 } = f5();
  run(d, { method: "setStatus", ticketId: s33.id, statusId: "todo" });
  run(d, { method: "setHold", ticketId: s33.id, reason: MINIO, since: TODAY });
  const step = view(d, s34.id);
  expect(step.startable).toBe(false);
  expect(step.startReason).toEqual({
    kind: "onHold",
    hold: { source: "dependency", key: keyOf(s33), reason: MINIO, since: TODAY },
  });
  expect(step.waitingOn).toEqual([keyOf(s33)]);
  expect(view(d, s33.id).startReason?.kind).toBe("onHold");
});

test("the feature goes on without its steps on hold and comes back when resumed", () => {
  const { d, root, s32, s33 } = f5();
  run(d, { method: "setHold", ticketId: s33.id, reason: MINIO, since: TODAY });
  expect(view(d, root.id).feature).toMatchObject({
    held: 3,
    nextStepId: s32.id,
    steps: { done: 1, total: 2 },
  });
  run(d, { method: "setStatus", ticketId: s32.id, statusId: "done" });
  expect(view(d, root.id).feature).toMatchObject({ status: "delivered", held: 3 });
  run(d, { method: "setHold", ticketId: s33.id, reason: null });
  expect(view(d, root.id).feature).toMatchObject({ status: "open", held: 0, remaining: 3 });
});

test("the last step does not wait for a step on hold", () => {
  const d = newDoc();
  const root = create(d, "Rapports");
  const first = create(d, "Gabarit", root.id);
  const last = create(d, "Génération PDF", root.id);
  expect(view(d, last.id).startReason).toEqual({ kind: "dependency", keys: [keyOf(first)] });
  run(d, { method: "setHold", ticketId: first.id, reason: MINIO, since: TODAY });
  expect(view(d, last.id).startable).toBe(true);
});
