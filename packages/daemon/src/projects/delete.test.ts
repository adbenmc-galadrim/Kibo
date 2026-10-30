import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError, type ProjectMeta, type ProjectSummary } from "@kibo/schema";
import { createProjectSettings, type ProjectSettings } from "../notes/settings";
import { LOCAL_CONTEXT, type RpcContext } from "../rpc-extensions";
import { createService } from "../service";
import { openStore } from "../store";
import { createProjectAdmin } from "./admin";

const REMOTE: RpcContext = { sessionHash: "r", remote: true };
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

type Failure = "settings" | "store" | null;
function setup(opts: { activeRuns?: number } = {}) {
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
  const admin = createProjectAdmin({
    docs: service.docs,
    settings,
    icons: service.icons,
    store,
    activeRuns: () => opts.activeRuns ?? 0,
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
  expect(seen).toEqual([{ projectId: null }]);
  expect(s.reopenedIds()).toEqual([]);
});

test("a remote session is refused before anything, even for an unknown project", () => {
  const s = setup();
  expect(codeOf(() => s.remove(REMOTE))).toBe("FORBIDDEN");
  expect(codeOf(() => s.remove(REMOTE, "nope"))).toBe("FORBIDDEN");
  s.intact();
  s.close();
});

test("an unknown project is NOT_FOUND", () => {
  const s = setup();
  expect(codeOf(() => s.remove(LOCAL_CONTEXT, "nope"))).toBe("NOT_FOUND");
  s.intact();
  s.close();
});

test("active runs refuse the deletion with CONFLICT and change nothing", () => {
  const s = setup({ activeRuns: 1 });
  expect(codeOf(() => s.remove())).toBe("CONFLICT");
  s.intact();
  s.close();
});

test("a failing step rolls every deletion back", () => {
  for (const failure of ["settings", "store"] as const) {
    const s = setup();
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
