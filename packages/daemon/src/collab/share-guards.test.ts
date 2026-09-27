import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createProjectDoc,
  enableServerAllocation,
  getProjectMeta,
  listTickets,
  MAX_TREE_DEPTH,
  validateSharedSnapshot,
} from "@kibo/core";
import { type ClientFrame, KiboError, type ProjectMeta, type ServerFrame } from "@kibo/schema";
import { fromBase64, toBase64 } from "@kibo/trust";
import { LoroDoc } from "loro-crdt";
import { createProjectSettings } from "../notes/settings";
import { call, createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { createProjectHosts } from "./project-hosts";
import { projectSyncInfo } from "./project-info";
import { joinProject, type ShareClient, type ShareDeps, shareProject } from "./share";
import { openSyncDb, type SyncDb } from "./sync-db";

type Reply = (frame: ClientFrame) => ServerFrame | KiboError;

let home: string;
let store: Store;
let service: Service;
let db: SyncDb;
let sent: ClientFrame[];
let reply: Reply;
let deps: ShareDeps;
const listeners = new Set<(frame: ServerFrame) => void>();

function fakeClient(): ShareClient {
  const emit = (frame: ServerFrame) => {
    for (const listener of [...listeners]) listener(frame);
  };
  return {
    status: () => ({
      state: "online",
      serverUrl: "wss://sync.kibo.test",
      user: { id: "u-adam", name: "Adam" },
      deviceId: "d1",
      retryAt: null,
      lastError: null,
      projects: [],
    }),
    request: async <T extends ServerFrame["type"]>(frame: ClientFrame, expected: T) => {
      sent.push(frame);
      const answer = reply(frame);
      if (answer instanceof KiboError) throw answer;
      if (answer.type !== expected) throw new Error(`unexpected ${answer.type}`);
      return answer as Extract<ServerFrame, { type: T }>;
    },
    send: (frame) => {
      sent.push(frame);
      const answer = reply(frame);
      if (!(answer instanceof KiboError)) queueMicrotask(() => emit(answer));
    },
    onFrame: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    attachProject: () => undefined,
    detachProject: () => undefined,
  };
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-share-"));
  store = openStore(home);
  service = createService(store, { user: "adam" });
  db = openSyncDb(store.db);
  db.setConfig({
    serverUrl: "wss://sync.kibo.test",
    caFile: null,
    userId: "u-adam",
    deviceId: "d1",
    displayName: "Adam",
  });
  sent = [];
  listeners.clear();
  reply = () => new KiboError("INTERNAL", "no reply scripted");
  const hosts = createProjectHosts(service.docs, "adam");
  deps = {
    client: fakeClient(),
    db,
    hosts,
    domains: () => [],
    settings: createProjectSettings(store.db),
    syncInfo: (id) => projectSyncInfo({ row: db.project(id), doc: hosts.host(id).doc(), members: [] }),
    timeoutMs: 200,
  };
});
afterEach(() => {
  store.close();
  rmSync(home, { recursive: true, force: true });
});

function serverSends(bytes: Uint8Array, projectId = "p-remote"): void {
  reply = (frame) => {
    if (frame.type === "redeem") {
      return { type: "joined", requestId: frame.requestId, projectId, name: "Kibo", role: "editor" };
    }
    if (frame.type === "subscribe") {
      const version = toBase64(new LoroDoc().oplogVersion().encode());
      return { type: "update", projectId, bytes: toBase64(bytes), serverSeq: 1, version };
    }
    return new KiboError("INTERNAL", `unexpected ${frame.type}`);
  };
}

function localShapedDoc(id: string): LoroDoc {
  const doc = createProjectDoc({ id, key: "REM", name: "Remote", folder: null, color: "#14B8A6" });
  doc.getMap("meta").delete("folder");
  doc.commit();
  return doc;
}

function remoteDoc(id = "p-remote"): LoroDoc {
  const doc = localShapedDoc(id);
  enableServerAllocation(doc);
  return doc;
}

const codeOf = async (p: Promise<unknown>): Promise<string | null> =>
  p.then(
    () => null,
    (e: unknown) => (e instanceof KiboError ? e.code : "UNKNOWN"),
  );

test("a joined project built from a snapshot blob is refused before it is registered", async () => {
  serverSends(remoteDoc().export({ mode: "snapshot" }));
  expect(await codeOf(joinProject(deps, { code: "CODE", folder: null }))).toBe("INVALID_INPUT");
  expect(deps.hosts.projectIds()).toEqual([]);
  expect(db.project("p-remote")).toBeNull();
  expect(sent.at(-1)).toEqual({ type: "unsubscribe", projectId: "p-remote" });
});

test("a joined project sent as a shallow snapshot is refused", async () => {
  const doc = remoteDoc();
  serverSends(doc.export({ mode: "shallow-snapshot", frontiers: doc.frontiers() }));
  expect(await codeOf(joinProject(deps, { code: "CODE", folder: null }))).toBe("INVALID_INPUT");
  expect(deps.hosts.projectIds()).toEqual([]);
});

test("a joined project nested too deep is refused before it is registered", async () => {
  const doc = remoteDoc();
  let node = doc.getTree("tickets").createNode();
  for (let i = 0; i < MAX_TREE_DEPTH + 5; i++) node = node.createNode();
  doc.commit();
  serverSends(doc.export({ mode: "update" }));
  expect(await codeOf(joinProject(deps, { code: "CODE", folder: null }))).toBe("TOO_LARGE");
  expect(deps.hosts.projectIds()).toEqual([]);
});

test("a joined project whose data names another project is refused", async () => {
  serverSends(remoteDoc("p-other").export({ mode: "update" }));
  expect(await codeOf(joinProject(deps, { code: "CODE", folder: null }))).toBe("INVALID_INPUT");
  expect(deps.hosts.projectIds()).toEqual([]);
});

test("a joined project gets the folder chosen on this machine only", async () => {
  serverSends(remoteDoc().export({ mode: "update" }));
  const meta = await joinProject(deps, { code: "CODE", folder: "/Users/lea/Remote" });
  expect(meta.id).toBe("p-remote");
  expect(getProjectMeta(deps.hosts.host("p-remote").doc()).folder).toBeNull();
  expect(service.docs.projectMeta("p-remote").folder).toBe("/Users/lea/Remote");
  expect(db.project("p-remote")?.role).toBe("editor");
});

function localProject(): ProjectMeta {
  const meta: ProjectMeta = call(service, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: "/Users/adam/Kibo",
    color: "#14B8A6",
  });
  call(service, {
    method: "command",
    projectId: meta.id,
    command: { method: "createTicket", title: "Schéma", assignee: { kind: "human", ref: "adam" } },
  });
  return meta;
}

test("the snapshot sent passes the server validation and carries no folder", async () => {
  const meta = localProject();
  reply = (frame) =>
    frame.type === "share"
      ? { type: "shared", requestId: frame.requestId, projectId: meta.id }
      : new KiboError("INTERNAL", "unexpected");
  await shareProject(deps, meta.id);
  const share = sent.find((f) => f.type === "share");
  if (share?.type !== "share") throw new Error("no share frame");
  const snapshot = LoroDoc.fromSnapshot(fromBase64(share.snapshot));
  expect(validateSharedSnapshot(snapshot, meta.id)).toEqual({ ok: true });
  expect(JSON.stringify(snapshot.toJSON())).not.toContain("/Users/adam");
  expect(service.docs.projectMeta(meta.id).folder).toBe("/Users/adam/Kibo");
  expect(listTickets(deps.hosts.host(meta.id).doc())[0]?.assignee).toEqual({ kind: "human", ref: "u-adam" });
});

test("a refused share leaves the project local, untouched and writable", async () => {
  const meta = localProject();
  reply = () => new KiboError("FORBIDDEN", "this project id is shared by someone else");
  expect(await codeOf(shareProject(deps, meta.id))).toBe("FORBIDDEN");
  const doc = deps.hosts.host(meta.id).doc();
  expect(getProjectMeta(doc).folder).toBe("/Users/adam/Kibo");
  expect(listTickets(doc)[0]?.assignee).toEqual({ kind: "human", ref: "adam" });
  expect(db.project(meta.id)).toBeNull();
  call(service, {
    method: "command",
    projectId: meta.id,
    command: { method: "createTicket", title: "Après" },
  });
});

test("a project that would fail the server validation is never sent", async () => {
  const meta = localProject();
  deps.hosts.mutate(meta.id, (doc) => {
    doc.getMap("meta").set("extra", "x");
  });
  expect(await codeOf(shareProject(deps, meta.id))).toBe("INVALID_INPUT");
  expect(sent).toEqual([]);
  call(service, {
    method: "command",
    projectId: meta.id,
    command: { method: "createTicket", title: "Après" },
  });
});

test("a server doc that imposes a folder is refused at join", async () => {
  const doc = remoteDoc();
  doc.getMap("meta").set("folder", "/tmp/evil");
  doc.commit();
  serverSends(doc.export({ mode: "update" }));
  expect(await codeOf(joinProject(deps, { code: "CODE", folder: null }))).toBe("INVALID_INPUT");
  expect(deps.hosts.projectIds()).toEqual([]);
});

test("a server doc whose keys are not allocated by the server is refused at join", async () => {
  serverSends(localShapedDoc("p-remote").export({ mode: "update" }));
  expect(await codeOf(joinProject(deps, { code: "CODE", folder: null }))).toBe("INVALID_INPUT");
  expect(deps.hosts.projectIds()).toEqual([]);
});

test("a resync doc that imposes a folder is refused", async () => {
  serverSends(remoteDoc().export({ mode: "update" }));
  await joinProject(deps, { code: "CODE", folder: null });
  const evil = remoteDoc();
  evil.getMap("meta").set("folder", "/tmp/evil");
  evil.commit();
  const host = deps.hosts.host("p-remote");
  expect(() => host.replaceDoc(evil)).toThrow("INVALID_INPUT");
  expect(() => host.replaceDoc(localShapedDoc("p-remote"))).toThrow("INVALID_INPUT");
  expect(service.docs.projectMeta("p-remote").folder).toBeNull();
});

test("a folder slipped into a shared doc by an update is never used", async () => {
  const doc = remoteDoc();
  serverSends(doc.export({ mode: "update" }));
  await joinProject(deps, { code: "CODE", folder: null });
  const before = doc.oplogVersion();
  doc.getMap("meta").set("folder", "/tmp/evil");
  doc.commit();
  deps.hosts.host("p-remote").applyRemote(doc.export({ mode: "update", from: before }));
  expect(getProjectMeta(deps.hosts.host("p-remote").doc()).folder).toBe("/tmp/evil");
  expect(service.docs.projectMeta("p-remote").folder).toBeNull();
  const snapshot = call(service, { method: "getProject", projectId: "p-remote" });
  expect(snapshot.meta.folder).toBeNull();
});

const detailOf = async (p: Promise<unknown>): Promise<string> =>
  p.then(
    () => "",
    (e: unknown) => (e instanceof KiboError ? `${e.code} ${e.detail}` : "UNKNOWN"),
  );

test("a join refused here after the code was used tells the owner to invite again", async () => {
  serverSends(remoteDoc().export({ mode: "snapshot" }));
  const detail = await detailOf(joinProject(deps, { code: "CODE", folder: null }));
  expect(detail).toStartWith("INVALID_INPUT");
  expect(detail).toContain("the project owner must remove this member, then invite again");
});

test("a share refused because the project is already in use says so", async () => {
  const meta = localProject();
  reply = () => new KiboError("CONFLICT", "conflict");
  const detail = await detailOf(shareProject(deps, meta.id));
  expect(detail).toStartWith("CONFLICT");
  expect(detail).toContain("already in use on the sync server");
});

test("sharing a project whose sync is suspended is refused, not reported as shared", async () => {
  const meta = localProject();
  db.upsertProject({
    projectId: meta.id,
    enabled: false,
    role: "owner",
    lastServerVersion: null,
    lastSyncAt: null,
    lastError: "TOO_LARGE",
    accessRevoked: false,
  });
  const detail = await detailOf(shareProject(deps, meta.id));
  expect(detail).toStartWith("CONFLICT");
  expect(detail).toContain("sync is suspended");
  expect(sent).toEqual([]);
});
