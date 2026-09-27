import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { enableServerAllocation, listTickets, projectDepthViolation } from "@kibo/core";
import { listGuidelines } from "@kibo/core/agent-config";
import { KiboError, type ProjectMeta } from "@kibo/schema";
import { LoroDoc } from "loro-crdt";
import { call, createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { createProjectHosts } from "./project-hosts";
import type { ProjectHostRegistry } from "./types";

let home: string;
let store: Store;
let service: Service;
let hosts: ProjectHostRegistry;
let projectId: string;

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), "kibo-hosts-"));
  store = openStore(home);
  service = createService(store, { user: "adam" });
  hosts = createProjectHosts(service.docs, "adam");
  const meta: ProjectMeta = call(service, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#14B8A6",
  });
  projectId = meta.id;
  hosts.mutate(projectId, (doc) => {
    doc.getMap("meta").delete("folder");
    enableServerAllocation(doc);
  });
});
afterEach(() => {
  store.close();
  rmSync(home, { recursive: true, force: true });
});

const create = async (title: string) =>
  service.handle({ method: "command", projectId, command: { method: "createTicket", title } });
function sharedShaped(doc: LoroDoc): LoroDoc {
  doc.getMap("meta").delete("folder");
  enableServerAllocation(doc);
  return doc;
}

const codeOf = (fn: () => unknown): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof KiboError ? e.code : "UNKNOWN";
  }
};

test("a read-only project refuses commands and rule triggers", async () => {
  hosts.setAccess(projectId, "read-only");
  await expect(create("Non")).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(codeOf(() => service.triggerRules(projectId, { kind: "run_done", ticketId: "x" }))).toBe(
    "FORBIDDEN",
  );
  hosts.setAccess(projectId, "revoked");
  await expect(create("Non")).rejects.toMatchObject({ code: "FORBIDDEN" });
  hosts.setAccess(projectId, "write");
  await create("Oui");
  expect(listTickets(hosts.host(projectId).doc()).map((t) => t.title)).toEqual(["Oui"]);
});

test("project guidelines go through the write guard", () => {
  const add = {
    method: "addGuideline",
    owner: { scope: "project", projectId },
    path: "x.md",
    content: "hi",
  } as const;
  hosts.setAccess(projectId, "revoked");
  expect(codeOf(() => service.handle({ method: "config", command: add }))).toBe("FORBIDDEN");
  expect(listGuidelines(hosts.host(projectId).doc())).toEqual([]);
  hosts.setAccess(projectId, "write");
  service.handle({ method: "config", command: add });
  expect(listGuidelines(hosts.host(projectId).doc())).toHaveLength(1);
});

test("a project being shared refuses commands with CONFLICT", async () => {
  hosts.setLocked(projectId, true);
  await expect(create("Non")).rejects.toMatchObject({ code: "CONFLICT" });
  hosts.setLocked(projectId, false);
  await create("Oui");
});

test("mutate writes through the guard, persists and reports the change", () => {
  const seen: string[] = [];
  const changes: unknown[] = [];
  hosts.onLocalChange((id) => seen.push(id));
  service.onChange((m) => changes.push(m));
  hosts.mutate(projectId, (doc) => doc.getMap("probe").set("k", 1));
  expect(seen).toEqual([projectId]);
  expect(changes).toContainEqual({ projectId });
  hosts.setAccess(projectId, "read-only");
  expect(codeOf(() => hosts.mutate(projectId, (doc) => doc.getMap("probe").set("k", 2)))).toBe("FORBIDDEN");
  store.close();
  store = openStore(home);
  expect(createService(store, { user: "adam" }).docs.project(projectId).getMap("probe").get("k")).toBe(1);
});

test("local writes are reported, remote imports are not", async () => {
  const seen: string[] = [];
  hosts.onLocalChange((id) => seen.push(id));
  await create("Local");
  expect([...new Set(seen)]).toEqual([projectId]);
  const before = seen.length;
  const remote = LoroDoc.fromSnapshot(hosts.host(projectId).doc().export({ mode: "snapshot" }));
  remote.getMap("probe").set("k", 1);
  remote.commit();
  hosts
    .host(projectId)
    .applyRemote(remote.export({ mode: "update", from: hosts.host(projectId).doc().oplogVersion() }));
  expect(seen).toHaveLength(before);
  expect(hosts.host(projectId).doc().getMap("probe").get("k")).toBe(1);
});

test("a replaced document is persisted and still watched", async () => {
  const copy = sharedShaped(LoroDoc.fromSnapshot(hosts.host(projectId).doc().export({ mode: "snapshot" })));
  hosts.host(projectId).replaceDoc(copy);
  expect(hosts.host(projectId).doc().toJSON()).toEqual(copy.toJSON());
  const seen: string[] = [];
  hosts.onLocalChange((id) => seen.push(id));
  await create("Après");
  expect([...new Set(seen)]).toEqual([projectId]);
  store.close();
  store = openStore(home);
  const reloaded = createService(store, { user: "adam" }).docs.project(projectId);
  expect(listTickets(reloaded).map((t) => t.title)).toEqual(["Après"]);
});

test("a joined project is registered with its local folder", () => {
  const doc = LoroDoc.fromSnapshot(hosts.host(projectId).doc().export({ mode: "snapshot" }));
  doc.getMap("meta").set("id", "joined-1");
  doc.getMap("meta").set("key", "JOI");
  doc.commit();
  const meta = hosts.addJoinedProject(doc, null);
  expect(meta).toMatchObject({ id: "joined-1", key: "JOI", folder: null });
  expect(hosts.projectIds()).toContain("joined-1");
  expect(hosts.host("joined-1").doc().toJSON()).toEqual(doc.toJSON());
  expect(hosts.localUser()).toBe("adam");
});

test("sync data nesting the project too deep is refused before it reaches the project", () => {
  const current = hosts.host(projectId).doc();
  const remote = LoroDoc.fromSnapshot(current.export({ mode: "snapshot" }));
  let node = remote.getTree("tickets").createNode();
  for (let i = 0; i < 100; i++) node = node.createNode();
  remote.commit();
  const bytes = remote.export({ mode: "update", from: current.oplogVersion() });
  expect(codeOf(() => hosts.host(projectId).applyRemote(bytes))).toBe("TOO_LARGE");
  expect(listTickets(hosts.host(projectId).doc())).toEqual([]);
  expect(codeOf(() => hosts.host(projectId).replaceDoc(remote))).toBe("TOO_LARGE");
  expect(hosts.host(projectId).doc()).toBe(current);
});

function outOfOrderDeepUpdates(current: LoroDoc): { first: Uint8Array; deep: Uint8Array } {
  const remote = LoroDoc.fromSnapshot(current.export({ mode: "snapshot" }));
  remote.getMap("probe").set("a", 1);
  remote.commit();
  const mid = remote.oplogVersion();
  const first = remote.export({ mode: "update", from: current.oplogVersion() });
  let node = remote.getTree("tickets").createNode();
  for (let i = 0; i < 100; i++) node = node.createNode();
  remote.commit();
  return { first, deep: remote.export({ mode: "update", from: mid }) };
}

test("an update whose dependencies are missing is refused, so it cannot unlock a deep tree later", () => {
  const { first, deep } = outOfOrderDeepUpdates(hosts.host(projectId).doc());
  expect(codeOf(() => hosts.host(projectId).applyRemote(deep))).toBe("TOO_LARGE");
  expect(codeOf(() => hosts.host(projectId).applyRemote(first))).toBeNull();
  const doc = hosts.host(projectId).doc();
  expect(projectDepthViolation(doc)).toBeNull();
  expect(doc.getMap("probe").get("a")).toBe(1);
  expect(doc.getTree("tickets").getNodes()).toEqual([]);
});

test("pending operations of a replacement doc are dropped, never unlocked later", () => {
  const current = hosts.host(projectId).doc();
  const { first, deep } = outOfOrderDeepUpdates(current);
  const fresh = sharedShaped(LoroDoc.fromSnapshot(current.export({ mode: "snapshot" })));
  fresh.import(deep);
  hosts.host(projectId).replaceDoc(fresh);
  hosts.host(projectId).applyRemote(first);
  expect(projectDepthViolation(hosts.host(projectId).doc())).toBeNull();
});

test("a joined project nested too deep is refused before registration", () => {
  const doc = LoroDoc.fromSnapshot(hosts.host(projectId).doc().export({ mode: "snapshot" }));
  doc.getMap("meta").set("id", "joined-deep");
  let node = doc.getTree("tickets").createNode();
  for (let i = 0; i < 100; i++) node = node.createNode();
  doc.commit();
  expect(codeOf(() => hosts.addJoinedProject(doc, null))).toBe("TOO_LARGE");
  expect(hosts.projectIds()).not.toContain("joined-deep");
});

test("forged update bytes are refused as invalid input and leave the project intact", () => {
  const before = hosts.host(projectId).doc().toJSON();
  const forged = new Uint8Array(64).map((_, i) => (i * 37 + 11) % 256);
  expect(codeOf(() => hosts.host(projectId).applyRemote(forged))).toBe("INVALID_INPUT");
  expect(hosts.host(projectId).doc().toJSON()).toEqual(before);
});
