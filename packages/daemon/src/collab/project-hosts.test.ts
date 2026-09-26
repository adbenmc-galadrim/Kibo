import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listTickets } from "@kibo/core";
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
});
afterEach(() => {
  store.close();
  rmSync(home, { recursive: true, force: true });
});

const create = async (title: string) =>
  service.handle({ method: "command", projectId, command: { method: "createTicket", title } });
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
  const copy = LoroDoc.fromSnapshot(hosts.host(projectId).doc().export({ mode: "snapshot" }));
  hosts.host(projectId).replaceDoc(copy);
  expect(hosts.host(projectId).doc()).toBe(copy);
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
  expect(hosts.host("joined-1").doc()).toBe(doc);
  expect(hosts.localUser()).toBe("adam");
});
