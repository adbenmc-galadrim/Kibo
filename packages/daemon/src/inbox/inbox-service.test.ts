import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type ChangeMessage,
  INBOX_ID,
  KiboError,
  type ProjectMeta,
  type ProjectSnapshot,
  type Ticket,
} from "@kibo/schema";
import { createProjectHosts } from "../collab/project-hosts";
import { projectDocId } from "../projects/doc-ids";
import { createService } from "../service";
import { openStore, type Store } from "../store";

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-inbox-svc-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const newProject = {
  method: "createProject",
  name: "Kibo",
  key: "KIB",
  folder: null,
  color: "#F97316",
} as const;
const inboxCommand = (command: { method: "createTicket"; title: string; parentId?: string }) =>
  ({ method: "command", projectId: INBOX_ID, command }) as const;

function failingSaves(store: Store, failOn: Set<string>): Store {
  return {
    ...store,
    save(id, snapshot) {
      if (failOn.has(id)) throw new Error(`disk full on ${id}`);
      store.save(id, snapshot);
    },
  };
}

const snapshotOf = (s: ReturnType<typeof createService>, projectId: string) =>
  s.handle({ method: "getProject", projectId }) as ProjectSnapshot;

describe("inbox", () => {
  test("tickets live in the inbox without any project, survive a restart, and never show in listProjects", () => {
    const dir = tmp();
    const store = openStore(dir);
    const s = createService(store, { user: "adam" });
    const a = s.handle(inboxCommand({ method: "createTicket", title: "Appeler le comptable" })) as Ticket;
    expect(a.key).toBe("INB-1");
    expect(s.handle({ method: "listProjects" })).toEqual([]);
    const snapshot = snapshotOf(s, INBOX_ID);
    expect([
      snapshot.meta.key,
      snapshot.pages,
      snapshot.instances,
      snapshot.sync.shared,
      snapshot.nextTicketKey,
    ]).toEqual(["INB", [], [], false, "INB-2"]);
    store.close();
    const again = openStore(dir);
    const s2 = createService(again, { user: "adam" });
    const b = s2.handle(inboxCommand({ method: "createTicket", title: "B" })) as Ticket;
    expect(b.key).toBe("INB-2");
    expect(s2.handle({ method: "listProjects" })).toEqual([]);
    again.close();
  });

  test("the inbox stays out of every project list: projectIds, sync hosts, doc listeners", () => {
    const store = openStore(tmp());
    const s = createService(store, { user: "adam" });
    const seenDocs: string[] = [];
    s.docs.onProjectDoc((id) => seenDocs.push(id));
    const p = s.handle(newProject) as ProjectMeta;
    s.handle(inboxCommand({ method: "createTicket", title: "A" }));
    const hosts = createProjectHosts(s.docs, "adam");
    expect(s.docs.projectIds()).toEqual([p.id]);
    expect(hosts.projectIds()).toEqual([p.id]);
    const failing = createService(failingSaves(store, new Set([projectDocId(INBOX_ID)])), { user: "adam" });
    failing.docs.onProjectDoc((id) => seenDocs.push(id));
    expect(() => failing.handle(inboxCommand({ method: "createTicket", title: "lost" }))).toThrow(
      "disk full",
    );
    expect(seenDocs).toEqual([p.id]);
    expect(snapshotOf(failing, INBOX_ID).tickets.map((t) => t.title)).toEqual(["A"]);
  });

  test("a first inbox write that fails leaves a fresh inbox that still numbers from INB-1", () => {
    const store = openStore(tmp());
    const failOn = new Set([projectDocId(INBOX_ID)]);
    const s = createService(failingSaves(store, failOn), { user: "adam" });
    expect(() => s.handle(inboxCommand({ method: "createTicket", title: "lost" }))).toThrow("disk full");
    expect(snapshotOf(s, INBOX_ID).tickets).toEqual([]);
    expect(store.load(projectDocId(INBOX_ID))).toBeNull();
    failOn.clear();
    expect((s.handle(inboxCommand({ method: "createTicket", title: "kept" })) as Ticket).key).toBe("INB-1");
  });

  test("the inbox refuses non-ticket commands from any caller, instances, and the INB project key", () => {
    const store = openStore(tmp());
    const s = createService(store, { user: "adam" });
    const before = store.load(projectDocId(INBOX_ID));
    const refused = [
      () =>
        s.handle({
          method: "command",
          projectId: INBOX_ID,
          command: { method: "addPage", title: "P", kind: "dashboard" },
        }),
      () =>
        s.handle({
          method: "command",
          projectId: INBOX_ID,
          instanceId: "i1",
          command: { method: "createTicket", title: "T" },
        }),
      () => s.docs.run(INBOX_ID, { method: "removeBinding", bindingId: "b1" }),
      () =>
        s.docs.run(INBOX_ID, {
          method: "importExternalTicket",
          title: "Issue",
          ref: {
            kind: "github_pr",
            url: "https://github.com/a/b/pull/1",
            number: 1,
            state: "open",
            base: null,
            head: null,
          },
        }),
      () =>
        s.docs.run(INBOX_ID, {
          method: "upsertExternalRef",
          ticketId: "1@1",
          ref: {
            kind: "github_pr",
            url: "https://github.com/a/b/pull/1",
            number: 1,
            state: "open",
            base: null,
            head: null,
          },
        }),
      () => s.handle({ ...newProject, key: "INB" }),
    ];
    for (const attempt of refused) expect(attempt).toThrow("INVALID_INPUT");
    expect(store.load(projectDocId(INBOX_ID))).toEqual(before);
    expect(snapshotOf(s, INBOX_ID).tickets).toEqual([]);
    expect(s.handle({ method: "listProjects" })).toEqual([]);
  });

  test("a project cannot be registered or replaced under the inbox id", () => {
    const s = createService(openStore(tmp()), { user: "adam" });
    const inbox = s.docs.project(INBOX_ID);
    const meta = {
      id: INBOX_ID,
      key: "KIB",
      name: "Fake",
      folder: null,
      color: "#F97316",
      worktree: null,
      storybook: null,
    };
    expect(() => s.docs.addProject(meta, inbox)).toThrow("INVALID_INPUT");
    expect(() => s.docs.replaceProject(INBOX_ID, inbox)).toThrow("INVALID_INPUT");
    expect(() => s.docs.removeProject(INBOX_ID)).toThrow("INVALID_INPUT");
    expect(s.handle({ method: "listProjects" })).toEqual([]);
  });
});

describe("fileTicket", () => {
  test("filing a ticket recreates it in the project with a new key and empties the inbox, in one transaction", () => {
    const s = createService(openStore(tmp()), { user: "adam" });
    const p = s.handle(newProject) as ProjectMeta;
    const root = s.handle(inboxCommand({ method: "createTicket", title: "Root" })) as Ticket;
    s.handle(inboxCommand({ method: "createTicket", title: "Child", parentId: root.id }));
    const seen: (string | null)[] = [];
    s.onChange((m: ChangeMessage) => {
      if ("projectId" in m) seen.push(m.projectId);
    });
    const filed = s.handle({ method: "fileTicket", ticketId: root.id, projectId: p.id }) as {
      ticketId: string;
      key: string | null;
    };
    expect(filed.key).toBe("KIB-1");
    const target = snapshotOf(s, p.id);
    expect(target.tickets.map((t) => [t.title, t.key])).toEqual([
      ["Root", "KIB-1"],
      ["Child", "KIB-2"],
    ]);
    expect(target.tickets[0]?.id).toBe(filed.ticketId);
    expect(snapshotOf(s, INBOX_ID).tickets).toEqual([]);
    expect(seen).toEqual([INBOX_ID, p.id]);
    expect(() => s.handle({ method: "fileTicket", ticketId: root.id, projectId: p.id })).toThrow("NOT_FOUND");
    expect(() => s.handle({ method: "fileTicket", ticketId: root.id, projectId: INBOX_ID })).toThrow(
      "INVALID_INPUT",
    );
    expect(() => s.handle({ method: "fileTicket", ticketId: root.id, projectId: "ghost" })).toThrow(
      "NOT_FOUND",
    );
  });

  test("refusals change nothing: read-only target, being shared, unknown ticket or parent", () => {
    const store = openStore(tmp());
    const s = createService(store, { user: "adam" });
    const p = s.handle(newProject) as ProjectMeta;
    const t = s.handle(inboxCommand({ method: "createTicket", title: "T" })) as Ticket;
    const seen: ChangeMessage[] = [];
    s.onChange((m) => seen.push(m));
    const bytes = () => [store.load(projectDocId(INBOX_ID)), store.load(projectDocId(p.id))];
    const before = bytes();
    let guard: KiboError | null = new KiboError("FORBIDDEN", "read-only");
    s.docs.setWriteGuard((id) => {
      if (id === p.id && guard) throw guard;
    });
    expect(() => s.handle({ method: "fileTicket", ticketId: t.id, projectId: p.id })).toThrow("FORBIDDEN");
    guard = new KiboError("CONFLICT", "being shared");
    expect(() => s.handle({ method: "fileTicket", ticketId: t.id, projectId: p.id })).toThrow("CONFLICT");
    guard = null;
    expect(() => s.handle({ method: "fileTicket", ticketId: "9@9", projectId: p.id })).toThrow("NOT_FOUND");
    expect(() =>
      s.handle({ method: "fileTicket", ticketId: t.id, projectId: p.id, parentId: "9@9" }),
    ).toThrow("NOT_FOUND");
    expect(bytes()).toEqual(before);
    expect(seen).toEqual([]);
    expect(snapshotOf(s, INBOX_ID).tickets).toHaveLength(1);
    expect(snapshotOf(s, p.id).tickets).toHaveLength(0);
  });

  test("a failure while saving restores both docs in memory and on disk", () => {
    const dir = tmp();
    const store = openStore(dir);
    const failOn = new Set<string>();
    const s = createService(failingSaves(store, failOn), { user: "adam" });
    const p = s.handle(newProject) as ProjectMeta;
    const root = s.handle(inboxCommand({ method: "createTicket", title: "Root" })) as Ticket;
    s.handle(inboxCommand({ method: "createTicket", title: "Child", parentId: root.id }));
    const seen: ChangeMessage[] = [];
    s.onChange((m) => seen.push(m));
    failOn.add(projectDocId(p.id));
    expect(() => s.handle({ method: "fileTicket", ticketId: root.id, projectId: p.id })).toThrow("disk full");
    expect(seen).toEqual([]);
    expect(snapshotOf(s, INBOX_ID).tickets.map((t) => t.key)).toEqual(["INB-1", "INB-2"]);
    expect(snapshotOf(s, p.id).tickets).toEqual([]);
    store.close();
    const reopened = createService(openStore(dir), { user: "adam" });
    expect(snapshotOf(reopened, INBOX_ID).tickets.map((t) => t.title)).toEqual(["Root", "Child"]);
    expect(snapshotOf(reopened, p.id).tickets).toEqual([]);
    expect(snapshotOf(reopened, p.id).nextTicketKey).toBe("KIB-1");
  });
});
