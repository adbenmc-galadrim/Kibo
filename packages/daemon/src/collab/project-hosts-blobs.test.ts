import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_TREE_DEPTH, projectDepthViolation } from "@kibo/core";
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

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-blobs-"));
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

const codeOf = (fn: () => unknown): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof KiboError ? e.code : "UNKNOWN";
  }
};
const treeSize = (doc: LoroDoc) => doc.getTree("tickets").getNodes({ withDeleted: true }).length;
const copyOf = (doc: LoroDoc) => LoroDoc.fromSnapshot(doc.export({ mode: "snapshot" }));

function deepChain(doc: LoroDoc, levels: number): void {
  let node = doc.getTree("tickets").createNode();
  for (let i = 1; i < levels; i++) node = node.createNode();
  doc.commit();
}

function shallowOf(doc: LoroDoc): Uint8Array {
  return doc.export({ mode: "shallow-snapshot", frontiers: doc.frontiers() });
}

test("a shallow snapshot is refused as an update, whether its history is known or not", () => {
  const current = hosts.host(projectId).doc();
  const remote = copyOf(current);
  deepChain(remote, MAX_TREE_DEPTH + 40);
  expect(codeOf(() => hosts.host(projectId).applyRemote(shallowOf(remote)))).toBe("INVALID_INPUT");
  const known = copyOf(current);
  known.getMap("probe").set("x", 1);
  known.commit();
  expect(codeOf(() => hosts.host(projectId).applyRemote(shallowOf(known)))).toBe("INVALID_INPUT");
  expect(hosts.host(projectId).doc().getMap("probe").get("x")).toBeUndefined();
  expect(treeSize(hosts.host(projectId).doc())).toBe(0);
});

test("a full snapshot blob is refused as an update: the server only sends update blobs", () => {
  const remote = copyOf(hosts.host(projectId).doc());
  remote.getMap("probe").set("s", 1);
  remote.commit();
  expect(codeOf(() => hosts.host(projectId).applyRemote(remote.export({ mode: "snapshot" })))).toBe(
    "INVALID_INPUT",
  );
  expect(hosts.host(projectId).doc().getMap("probe").get("s")).toBeUndefined();
});

test("a shallow replacement doc hides its history from the depth check and is refused", () => {
  const current = hosts.host(projectId).doc();
  const remote = copyOf(current);
  deepChain(remote, MAX_TREE_DEPTH + 40);
  const fresh = new LoroDoc();
  fresh.import(shallowOf(remote));
  expect(fresh.isShallow()).toBe(true);
  expect(projectDepthViolation(fresh)).toBeNull();
  expect(codeOf(() => hosts.host(projectId).replaceDoc(fresh))).toBe("INVALID_INPUT");
  expect(hosts.host(projectId).doc()).toBe(current);
});

test("a shallow joined doc is refused before registration", () => {
  const remote = copyOf(hosts.host(projectId).doc());
  deepChain(remote, MAX_TREE_DEPTH + 40);
  const joined = new LoroDoc();
  joined.import(shallowOf(remote));
  joined.getMap("meta").set("id", "joined-shallow");
  joined.getMap("meta").set("key", "JOI");
  joined.commit();
  expect(codeOf(() => hosts.addJoinedProject(joined, null))).toBe("INVALID_INPUT");
  expect(hosts.projectIds()).not.toContain("joined-shallow");
});

test("a joined doc carrying pending deep ops is adopted without them, so they never unlock", () => {
  const current = hosts.host(projectId).doc();
  const remote = copyOf(current);
  remote.getMap("probe").set("a", 1);
  remote.commit();
  const mid = remote.oplogVersion();
  const first = remote.export({ mode: "update", from: current.oplogVersion() });
  deepChain(remote, MAX_TREE_DEPTH + 40);
  const deep = remote.export({ mode: "update", from: mid });
  const joined = copyOf(current);
  joined.getMap("meta").set("id", "joined-pending");
  joined.getMap("meta").set("key", "JOI");
  joined.commit();
  joined.import(deep);
  hosts.addJoinedProject(joined, null);
  expect(codeOf(() => hosts.host("joined-pending").applyRemote(first))).toBeNull();
  const doc = hosts.host("joined-pending").doc();
  expect(doc.getMap("probe").get("a")).toBe(1);
  expect(treeSize(doc)).toBe(0);
});

test("depth reached across two updates is refused at the second, by creation or by move", () => {
  const current = hosts.host(projectId).doc();
  const remote = copyOf(current);
  const tree = remote.getTree("tickets");
  let a = tree.createNode();
  for (let i = 1; i < 40; i++) a = a.createNode();
  const bRoot = tree.createNode();
  let b = bRoot;
  for (let i = 1; i < 40; i++) b = b.createNode();
  remote.commit();
  const first = remote.export({ mode: "update", from: current.oplogVersion() });
  const mid = remote.oplogVersion();
  const leaf = a;
  for (let i = 0; i < 40; i++) a = a.createNode();
  remote.commit();
  const grown = remote.export({ mode: "update", from: mid });
  const moved = copyOf(current);
  moved.import(first);
  moved.getTree("tickets").move(bRoot.id, leaf.id);
  moved.commit();
  const move = moved.export({ mode: "update", from: mid });
  expect(codeOf(() => hosts.host(projectId).applyRemote(first))).toBeNull();
  expect(codeOf(() => hosts.host(projectId).applyRemote(grown))).toBe("TOO_LARGE");
  expect(codeOf(() => hosts.host(projectId).applyRemote(move))).toBe("TOO_LARGE");
  expect(treeSize(hosts.host(projectId).doc())).toBe(80);
  expect(projectDepthViolation(hosts.host(projectId).doc())).toBeNull();
});
