import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Domain,
  EMPTY_TABS,
  type Instance,
  MAX_RECENTS,
  MAX_TABS,
  type Page,
  type ProjectCommand,
  type ProjectMeta,
  type ProjectSnapshot,
  type ProjectSummary,
  type Ticket,
  type WorkspaceConfig,
} from "@kibo/schema";
import { call, createService } from "./service";
import { openStore } from "./store";

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-svc-"));
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

describe("service", () => {
  test("lists projects with their ticket counts by status", () => {
    const store = openStore(tmp());
    const s = createService(store, { user: "adam" });
    const p = s.handle(newProject) as ProjectMeta;
    s.handle({ method: "command", projectId: p.id, command: { method: "createTicket", title: "A" } });
    s.handle({
      method: "command",
      projectId: p.id,
      command: { method: "createTicket", title: "B", statusId: "in_progress" },
    });
    const [summary] = s.handle({ method: "listProjects" }) as ProjectSummary[];
    expect(summary).toEqual({
      ...p,
      counts: { backlog: 0, todo: 1, in_progress: 1, in_review: 0, blocked: 0, done: 0 },
    });
    store.close();
  });

  test("keys stay unique and continue after a restart", () => {
    const home = tmp();
    const store1 = openStore(home);
    const s1 = createService(store1, { user: "adam" });
    const p = s1.handle(newProject) as ProjectMeta;
    for (let i = 0; i < 50; i++) {
      s1.handle({ method: "command", projectId: p.id, command: { method: "createTicket", title: `T${i}` } });
    }
    store1.close();

    const store2 = openStore(home);
    const s2 = createService(store2, { user: "adam" });
    const t = s2.handle({
      method: "command",
      projectId: p.id,
      command: { method: "createTicket", title: "next" },
    }) as Ticket;
    expect(t.key).toBe("KIB-51");
    const snap = s2.handle({ method: "getProject", projectId: p.id }) as ProjectSnapshot;
    expect(new Set(snap.tickets.map((x) => x.key)).size).toBe(51);
    store2.close();
  });

  test("notifies listeners of what changed", () => {
    const store = openStore(tmp());
    const s = createService(store, { user: "adam" });
    const seen: (string | null)[] = [];
    const off = s.onChange((m) =>
      seen.push("projectId" in m ? m.projectId : "topic" in m ? m.topic : m.runId),
    );
    const p = s.handle(newProject) as ProjectMeta;
    s.handle({
      method: "command",
      projectId: p.id,
      command: { method: "addPage", title: "Kanban", kind: "view" },
    });
    off();
    s.handle({
      method: "command",
      projectId: p.id,
      command: { method: "addPage", title: "Notes", kind: "view" },
    });
    expect(seen).toEqual([null, p.id]);
    store.close();
  });

  test("reports unknown projects and exposes the session", () => {
    const store = openStore(tmp());
    const s = createService(store, { user: "adam" });
    expect(s.handle({ method: "getSession" })).toEqual({ user: "adam", notifications: "browser" });
    expect(() => s.handle({ method: "getProject", projectId: "nope" })).toThrow("NOT_FOUND");
    store.close();
  });
  test("session, configuration and domain usage", () => {
    const store = openStore(tmp());
    const s = createService(store, { user: "adam", notifications: "native" });
    expect(s.handle({ method: "getSession" })).toEqual({ user: "adam", notifications: "native" });
    const messages: unknown[] = [];
    s.onChange((m) => messages.push(m));
    const p = s.handle(newProject) as ProjectMeta;
    const core = s.handle({
      method: "config",
      command: { method: "createDomain", domain: { name: "Core", color: "#14B8A6" } },
    }) as Domain;
    expect(messages).toContainEqual({ topic: "config" });
    const t = s.handle({
      method: "command",
      projectId: p.id,
      command: { method: "createTicket", title: "A" },
    }) as Ticket;
    messages.length = 0;
    s.handle({
      method: "command",
      projectId: p.id,
      command: { method: "updateTicket", ticketId: t.id, domainId: core.id },
    });
    expect(messages).toEqual([{ projectId: p.id }, { topic: "config" }]);
    s.handle({
      method: "config",
      command: {
        method: "addGuideline",
        owner: { scope: "project", projectId: p.id },
        path: "kibo.md",
        content: "# K",
      },
    });
    s.handle({
      method: "config",
      command: { method: "addGuideline", owner: { scope: "workspace" }, path: "general.md", content: "# G" },
    });
    const config = s.handle({ method: "getConfig" }) as WorkspaceConfig;
    expect(config.domains.map((d) => d.name)).toEqual(["Core"]);
    expect(config.guidelines.map((g) => g.path).sort()).toEqual(["general.md", "kibo.md"]);
    expect(config.domainUsage).toEqual({ [core.id]: 1 });
    expect(() =>
      s.handle({ method: "config", command: { method: "deleteDomain", domainId: core.id } }),
    ).toThrow("INVALID_INPUT");
    expect(() => s.handle({ method: "getAgents" })).toThrow("INTERNAL");
    store.close();
  });

  test("configuration survives a restart", () => {
    const home = tmp();
    const store1 = openStore(home);
    const s1 = createService(store1, { user: "adam" });
    const p = s1.handle(newProject) as ProjectMeta;
    s1.handle({
      method: "config",
      command: { method: "createDomain", domain: { name: "Core", color: "#14B8A6" } },
    });
    s1.handle({
      method: "config",
      command: {
        method: "addGuideline",
        owner: { scope: "project", projectId: p.id },
        path: "k.md",
        content: "#",
      },
    });
    expect((s1.handle({ method: "getConfig" }) as WorkspaceConfig).workspaceName).toBeNull();
    s1.handle({ method: "config", command: { method: "renameWorkspace", name: "Maison" } });
    store1.close();
    const store2 = openStore(home);
    const config = createService(store2, { user: "adam" }).handle({ method: "getConfig" }) as WorkspaceConfig;
    expect(config.domains.map((d) => d.name)).toEqual(["Core"]);
    expect(config.guidelines.map((g) => g.path)).toEqual(["k.md"]);
    expect(config.workspaceName).toBe("Maison");
    store2.close();
  });

  test("setting the last child done closes the parent through the rules", () => {
    const store = openStore(tmp());
    const s = createService(store, { user: "adam" });
    const p = s.handle(newProject) as ProjectMeta;
    const run = (command: ProjectCommand) => s.handle({ method: "command", projectId: p.id, command });
    const parent = run({ method: "createTicket", title: "P", statusId: "in_progress" }) as Ticket;
    const child = run({ method: "createTicket", title: "C", parentId: parent.id }) as Ticket;
    run({ method: "setStatus", ticketId: child.id, statusId: "done" });
    const snap = s.handle({ method: "getProject", projectId: p.id }) as ProjectSnapshot;
    expect(snap.tickets.find((x) => x.id === parent.id)?.statusId).toBe("done");
    store.close();
  });

  test("the command RPC refuses daemon-only commands and allows instance config", () => {
    const store = openStore(tmp());
    const s = createService(store, { user: "adam" });
    const p = s.handle(newProject) as ProjectMeta;
    const run = (command: ProjectCommand) => s.handle({ method: "command", projectId: p.id, command });
    const page = run({ method: "addPage", title: "Board", kind: "dashboard" }) as Page;
    const inst = run({ method: "addInstance", pageId: page.id, component: "hello@0.1.0" }) as Instance;
    const changes: unknown[] = [];
    s.onChange((m) => changes.push(m));
    expect(() => run({ method: "setInstanceData", instanceId: inst.id, key: "k", value: 1 })).toThrow(
      "PERMISSION_DENIED",
    );
    expect(() =>
      run({
        method: "setInstanceComponent",
        instanceId: inst.id,
        component: "hello@0.2.0",
        config: {},
        data: null,
      }),
    ).toThrow("PERMISSION_DENIED");
    expect(changes).toEqual([]);
    run({ method: "setInstanceConfig", instanceId: inst.id, config: { a: 1 } });
    const snap = s.handle({ method: "getProject", projectId: p.id }) as ProjectSnapshot;
    expect(snap.instances).toMatchObject([{ id: inst.id, component: "hello@0.1.0", config: { a: 1 } }]);
    store.close();
  });
});

describe("tabs", () => {
  const target = { kind: "project" as const, projectId: "p1" };
  const state = {
    tabs: [{ id: "t1", target, pinned: true }],
    activeId: "t1",
    recents: [target],
  };
  const tooManyTabs = {
    tabs: Array.from({ length: MAX_TABS + 1 }, (_, i) => ({ id: `t${i}`, target, pinned: false })),
    activeId: null,
    recents: [],
  };

  test("getTabs defaults to the empty state, saveTabs persists across services", () => {
    const store = openStore(tmp());
    expect(call(createService(store, { user: "adam" }), { method: "getTabs" })).toEqual(EMPTY_TABS);
    expect(call(createService(store, { user: "adam" }), { method: "saveTabs", state })).toBeNull();
    expect(call(createService(store, { user: "adam" }), { method: "getTabs" })).toEqual(state);
    store.close();
  });

  test("an unreadable stored state is reported and replaced by the empty state", () => {
    const store = openStore(tmp());
    store.setLocal("tabs:workspace", "{not json");
    const errors = spyOn(console, "error").mockImplementation(() => {});
    expect(call(createService(store, { user: "adam" }), { method: "getTabs" })).toEqual(EMPTY_TABS);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
    store.close();
  });

  test("a stored tab with an unknown target is dropped, the others are kept", () => {
    const store = openStore(tmp());
    const unknown = { id: "t2", target: { kind: "future" }, pinned: false };
    store.setLocal("tabs:workspace", JSON.stringify({ ...state, tabs: [...state.tabs, unknown] }));
    const errors = spyOn(console, "error").mockImplementation(() => {});
    expect(call(createService(store, { user: "adam" }), { method: "getTabs" })).toEqual(state);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
    store.close();
  });

  test("a stored state beyond the bounds is reported and replaced by the empty state", () => {
    const store = openStore(tmp());
    store.setLocal("tabs:workspace", JSON.stringify(tooManyTabs));
    const errors = spyOn(console, "error").mockImplementation(() => {});
    expect(call(createService(store, { user: "adam" }), { method: "getTabs" })).toEqual(EMPTY_TABS);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
    store.close();
  });

  test("saveTabs refuses a state beyond the bounds and keeps the previous one", () => {
    const store = openStore(tmp());
    const s = createService(store, { user: "adam" });
    call(s, { method: "saveTabs", state });
    const tooManyRecents = { ...state, recents: Array.from({ length: MAX_RECENTS + 1 }, () => target) };
    expect(() => s.handle({ method: "saveTabs", state: tooManyTabs })).toThrow("INVALID_INPUT");
    expect(() => s.handle({ method: "saveTabs", state: tooManyRecents })).toThrow("INVALID_INPUT");
    expect(call(s, { method: "getTabs" })).toEqual(state);
    store.close();
  });
});
