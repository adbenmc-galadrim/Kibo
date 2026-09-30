import { afterEach, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError, type ProjectMeta, type ProjectSummary, type ProjectSyncInfo } from "@kibo/schema";
import { createProjectSettings, type ProjectSettings } from "../notes/settings";
import { LOCAL_CONTEXT, type RpcContext } from "../rpc-extensions";
import { createService } from "../service";
import { openStore } from "../store";
import { createProjectAdmin } from "./admin";

const REMOTE: RpcContext = { sessionHash: "r", remote: true };
const LOCAL_SYNC: ProjectSyncInfo = {
  shared: false,
  keyAllocator: "local",
  role: null,
  access: "write",
  members: [],
};
const SHARED_SYNC: ProjectSyncInfo = { ...LOCAL_SYNC, shared: true, keyAllocator: "server", role: "editor" };
const PNG = "iVBORw0KGgoAAA==";
const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-delete-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

type Failure = "settings" | "detach" | "store" | null;
type SetupOptions = { sharing?: ProjectSyncInfo; activeRuns?: number };

function setup(opts: SetupOptions = {}) {
  const home = tmp();
  const store = openStore(home);
  let failing: Failure = null;
  const service = createService(
    {
      ...store,
      save: (id, snapshot) => {
        if (failing === "store" && id === "workspace") throw new Error("disk full");
        store.save(id, snapshot);
      },
    },
    { user: "adam" },
  );
  const real = createProjectSettings(store.db);
  const settings: ProjectSettings = {
    ...real,
    remove: (projectId) => {
      real.remove(projectId);
      if (failing === "settings") throw new Error("settings broke");
    },
  };
  const project = service.handle({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#F97316",
  }) as ProjectMeta;
  const detach = mock((projectId: string) => {
    real.set(projectId, "detached", "yes");
    if (failing === "detach") throw new Error("detach broke");
  });
  const admin = createProjectAdmin({
    docs: service.docs,
    settings,
    icons: service.icons,
    store,
    sharing: () => opts.sharing ?? LOCAL_SYNC,
    activeRuns: () => opts.activeRuns ?? 0,
    detach,
    folderExists: () => true,
  });
  const iconKey = `project:${project.id}`;
  admin.setIcon({
    method: "setIcon",
    owner: { kind: "project", projectId: project.id },
    icon: { mime: "image/png", data: PNG },
  });
  real.set(project.id, "notesDir", "/tmp/ok/notes");
  const remove = (ctx: RpcContext = LOCAL_CONTEXT, projectId = project.id) =>
    admin.deleteProject({ method: "deleteProject", projectId }, ctx);
  const ids = () => (service.handle({ method: "listProjects" }) as ProjectSummary[]).map((p) => p.id);
  const intact = () => {
    expect(ids()).toEqual([project.id]);
    expect(service.docs.project(project.id)).toBeDefined();
    expect(store.load(`project:${project.id}`)).not.toBeNull();
    expect(real.get(project.id, "notesDir")).toBe("/tmp/ok/notes");
    expect(real.get(project.id, "detached")).toBeNull();
    expect(service.icons.get(iconKey)).not.toBeNull();
  };
  const reopenedIds = () => {
    store.close();
    const again = openStore(home);
    const listed = (
      createService(again, { user: "adam" }).handle({ method: "listProjects" }) as ProjectSummary[]
    ).map((p) => p.id);
    again.close();
    return listed;
  };
  return {
    service,
    store,
    real,
    project,
    admin,
    detach,
    iconKey,
    remove,
    ids,
    intact,
    reopenedIds,
    fail: (failure: Failure) => {
      failing = failure;
    },
    close: () => store.close(),
  };
}

const codeOf = (fn: () => unknown): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof KiboError ? e.code : String(e);
  }
};

test("deletes a local project with its settings and image, and it does not come back", () => {
  const s = setup();
  const seen: unknown[] = [];
  s.service.onChange((m) => seen.push(m));
  expect(s.remove()).toBeNull();
  expect(s.ids()).toEqual([]);
  expect(codeOf(() => s.service.handle({ method: "getProject", projectId: s.project.id }))).toBe("NOT_FOUND");
  expect(s.real.get(s.project.id, "notesDir")).toBeNull();
  expect(s.service.icons.get(s.iconKey)).toBeNull();
  expect(s.store.load(`project:${s.project.id}`)).toBeNull();
  expect(s.detach).not.toHaveBeenCalled();
  expect(seen).toEqual([{ projectId: null }]);
  expect(s.reopenedIds()).toEqual([]);
});

test("a remote session is refused before anything, even for an unknown project", () => {
  const s = setup();
  expect(codeOf(() => s.remove(REMOTE))).toBe("FORBIDDEN");
  expect(codeOf(() => s.remove(REMOTE, "nope"))).toBe("FORBIDDEN");
  s.intact();
  expect(s.detach).not.toHaveBeenCalled();
  s.close();
});

test("an unknown project is NOT_FOUND", () => {
  const s = setup();
  expect(codeOf(() => s.remove(LOCAL_CONTEXT, "nope"))).toBe("NOT_FOUND");
  s.intact();
  s.close();
});

test("active runs refuse the deletion with CONFLICT and change nothing", () => {
  for (const sharing of [LOCAL_SYNC, SHARED_SYNC]) {
    const s = setup({ activeRuns: 1, sharing });
    expect(codeOf(() => s.remove())).toBe("CONFLICT");
    s.intact();
    expect(s.detach).not.toHaveBeenCalled();
    s.close();
  }
});

test("the owner of an active share is refused with CONFLICT and nothing is detached", () => {
  for (const access of ["write", "read-only"] as const) {
    const s = setup({ sharing: { ...SHARED_SYNC, role: "owner", access } });
    expect(codeOf(() => s.remove())).toBe("CONFLICT");
    s.intact();
    expect(s.detach).not.toHaveBeenCalled();
    expect(s.reopenedIds()).toEqual([s.project.id]);
  }
});

test("a member, a viewer or a revoked owner leaves the project: detached, then deleted", () => {
  const cases: ProjectSyncInfo[] = [
    SHARED_SYNC,
    { ...SHARED_SYNC, role: "viewer", access: "read-only" },
    { ...SHARED_SYNC, role: "editor", access: "revoked" },
    { ...SHARED_SYNC, role: "owner", access: "revoked" },
  ];
  for (const sharing of cases) {
    const s = setup({ sharing });
    expect(s.remove()).toBeNull();
    expect(s.detach).toHaveBeenCalledTimes(1);
    expect(s.detach).toHaveBeenCalledWith(s.project.id);
    expect(s.ids()).toEqual([]);
    expect(s.service.icons.get(s.iconKey)).toBeNull();
    expect(s.reopenedIds()).toEqual([]);
  }
});

test("a failing step rolls every deletion back", () => {
  for (const failure of ["settings", "detach", "store"] as const) {
    const s = setup({ sharing: SHARED_SYNC });
    s.fail(failure);
    expect(() => s.remove()).toThrow();
    s.fail(null);
    s.intact();
    expect(s.reopenedIds()).toEqual([s.project.id]);
  }
});

test("the handler routes deleteProject with its session context", async () => {
  const s = setup();
  const req = { method: "deleteProject", projectId: s.project.id } as const;
  await expect(s.admin.handler(req, REMOTE)).rejects.toThrow("FORBIDDEN");
  s.intact();
  expect(await s.admin.handler(req, LOCAL_CONTEXT)).toEqual({ handled: true, result: null });
  expect(s.ids()).toEqual([]);
  s.close();
});
