import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectDoc, createTicket, listTickets, walkDepthFirst } from "@kibo/core";
import type { ProjectEventInput } from "@kibo/schema";
import fc from "fast-check";
import { type LoroDoc, LoroMap } from "loro-crdt";
import { createProjectSettings, ensureSettingsTable, type ProjectSettings } from "../notes/settings";
import { call, createService } from "../service";
import { openStore } from "../store";
import {
  allocatePendingKeys,
  LOCAL_KEYS_MARKER,
  restoreLocalKeys,
  restoreLocalKeysOnce,
  ticketCreationLamport,
} from "./local-keys";

const NOW = 1_700_000_000_000;

function project(): LoroDoc {
  return createProjectDoc({
    id: "p",
    key: "SILO",
    name: "Silo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  });
}

function settings(): ProjectSettings {
  const db = new Database(":memory:", { strict: true });
  ensureSettingsTable(db);
  return createProjectSettings(db);
}

const seqOf = (key: string): number => Number(key.slice("SILO-".length));

function shareTheOldWay(doc: LoroDoc): void {
  doc.getMap("meta").set("keyAllocator", "server");
  doc.commit();
}

function writeOldMembers(doc: LoroDoc, members: { userId: string; name: string }[]): void {
  const directory = doc.getMap("meta").setContainer("members", new LoroMap());
  for (const m of members) directory.set(m.userId, { name: m.name });
  doc.commit();
}

let pendingSeq = 0;

function createPending(doc: LoroDoc, title: string, opts: { feature?: boolean; parentId?: string } = {}) {
  const tree = doc.getTree("tickets");
  const parent = walkDepthFirst(tree).find((n) => n.id === opts.parentId);
  const node = parent ? parent.createNode() : tree.createNode();
  pendingSeq += 1;
  node.data.set("key", null);
  node.data.set("pendingSeq", pendingSeq);
  if (opts.feature) node.data.set("feature", true);
  node.data.set("title", title);
  node.data.set("statusId", "todo");
  node.data.set("blockedReason", null);
  doc.commit();
  return { id: node.id };
}

const serverAllocated = (doc: LoroDoc): boolean => doc.getMap("meta").get("keyAllocator") === "server";

type Step = { kind: "ticket" | "feature" | "child" | "server" };

const step: fc.Arbitrary<Step> = fc.record({
  kind: fc.constantFrom<Step["kind"]>("ticket", "ticket", "feature", "child", "server"),
});

function play(doc: LoroDoc, steps: Step[], shared: boolean): void {
  let parent: string | null = null;
  const create = (title: string, opts: { feature?: boolean; parentId?: string } = {}) =>
    shared ? createPending(doc, title, opts) : createTicket(doc, { title, ...opts });
  for (const [i, s] of steps.entries()) {
    if (s.kind === "server") {
      if (shared) allocatePendingKeys(doc);
    } else if (s.kind === "feature") create(`Fonctionnalité ${i}`, { feature: true });
    else if (s.kind === "child" && parent !== null) create(`Étape ${i}`, { parentId: parent });
    else parent = create(`Ticket ${i}`).id;
  }
}

test("after restoreLocalKeysOnce, no ticket has a pendingSeq and the keys are unique and increasing", () => {
  fc.assert(
    fc.property(
      fc.array(step, { maxLength: 8 }),
      fc.array(step, { minLength: 1, maxLength: 12 }),
      (before, after) => {
        const doc = project();
        play(doc, before, false);
        shareTheOldWay(doc);
        play(doc, after, true);
        expect(restoreLocalKeysOnce(doc, settings(), "p", () => NOW)).not.toBeNull();
        const tickets = listTickets(doc);
        expect(tickets.every((t) => t.key !== null)).toBe(true);
        const nodes = walkDepthFirst(doc.getTree("tickets"));
        expect(nodes.every((n) => typeof n.data.get("pendingSeq") !== "number")).toBe(true);
        const keys = tickets.map((t) => t.key);
        expect(new Set(keys).size).toBe(keys.length);
        const seqs = tickets
          .map((t) => ({ key: t.key ?? "", at: ticketCreationLamport(doc, t.id) }))
          .filter((t) => t.key.startsWith("SILO-"))
          .sort((a, b) => a.at - b.at)
          .map((t) => seqOf(t.key));
        expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
        expect(serverAllocated(doc)).toBe(false);
        const next = createTicket(doc, { title: "Après" });
        expect(seqOf(next.key ?? "")).toBe(Math.max(0, ...seqs) + 1);
      },
    ),
  );
});

test("a server-allocated project gets its keys, loses its members, and the marker is set once", () => {
  const doc = project();
  createTicket(doc, { title: "Avant" });
  shareTheOldWay(doc);
  writeOldMembers(doc, [{ userId: "u-lea", name: "Léa" }]);
  const pending = createPending(doc, "En attente");
  const store = settings();
  expect(restoreLocalKeysOnce(doc, store, "p", () => NOW)).toEqual([{ ticketId: pending.id, key: "SILO-2" }]);
  expect(doc.getMap("meta").get("members")).toBeUndefined();
  expect(store.get("p", LOCAL_KEYS_MARKER)).toBe(new Date(NOW).toISOString());
  expect(restoreLocalKeysOnce(doc, store, "p", () => NOW + 1)).toBeNull();
});

test("a local project is only marked", () => {
  const doc = project();
  createTicket(doc, { title: "Local" });
  const version = doc.version().toJSON();
  const store = settings();
  expect(restoreLocalKeysOnce(doc, store, "p", () => NOW)).toEqual([]);
  expect(doc.version().toJSON()).toEqual(version);
  expect(store.get("p", LOCAL_KEYS_MARKER)).not.toBeNull();
});

test("at start, every shared project gets its keys back with one « keys_assigned » event, once", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-local-keys-"));
  try {
    const store = openStore(home);
    const service = createService(store, { user: "adam" });
    const local = call(service, {
      method: "createProject",
      name: "Local",
      key: "LOC",
      folder: null,
      color: "#F97316",
    });
    const shared = call(service, {
      method: "createProject",
      name: "Silo",
      key: "SILO",
      folder: null,
      color: "#F97316",
    });
    const doc = service.docs.project(shared.id);
    shareTheOldWay(doc);
    const pending = createPending(doc, "En attente");
    service.docs.save(shared.id);
    const recorded: { projectId: string; event: ProjectEventInput }[] = [];
    const deps = {
      docs: service.docs,
      settings: createProjectSettings(store.db),
      sink: { record: (projectId: string, event: ProjectEventInput) => recorded.push({ projectId, event }) },
      now: () => NOW,
    };
    restoreLocalKeys(deps);
    restoreLocalKeys(deps);
    expect(recorded).toEqual([
      {
        projectId: shared.id,
        event: { kind: "keys_assigned", ticketId: null, featureId: null, source: "kibo", data: { count: 1 } },
      },
    ]);
    store.close();
    const reopened = openStore(home);
    const again = createService(reopened, { user: "adam" });
    expect(serverAllocated(again.docs.project(shared.id))).toBe(false);
    expect(listTickets(again.docs.project(shared.id)).find((t) => t.id === pending.id)?.key).toBe("SILO-1");
    expect(listTickets(again.docs.project(local.id))).toEqual([]);
    reopened.close();
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
