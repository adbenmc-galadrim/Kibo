import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  INBOX_ID,
  KiboError,
  type ProjectMeta,
  type ProjectSnapshot,
  type ProjectSummary,
  type ProjectSyncInfo,
} from "@kibo/schema";
import { createProjectSettings } from "../notes/settings";
import { LOCAL_FOLDER_KEY } from "../project-folder";
import { LOCAL_CONTEXT, type RpcContext } from "../rpc-extensions";
import { createService } from "../service";
import { openStore } from "../store";
import { createProjectAdmin, folderIsDirectory } from "./admin";

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
  const d = mkdtempSync(join(tmpdir(), "kibo-admin-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function setup(opts: { sharing?: ProjectSyncInfo; activeRuns?: number } = {}) {
  const store = openStore(tmp());
  const service = createService(store, { user: "adam" });
  const settings = createProjectSettings(store.db);
  const project = service.handle({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#F97316",
  }) as ProjectMeta;
  const probed: string[] = [];
  const admin = createProjectAdmin({
    docs: service.docs,
    settings,
    icons: service.icons,
    store,
    sharing: () => opts.sharing ?? LOCAL_SYNC,
    activeRuns: () => opts.activeRuns ?? 0,
    detach: () => {},
    isLocked: () => false,
    folderExists: (path) => {
      probed.push(path);
      return path.startsWith("/tmp/ok");
    },
  });
  const summary = () => (service.handle({ method: "listProjects" }) as ProjectSummary[])[0];
  const snapshot = () => service.handle({ method: "getProject", projectId: project.id }) as ProjectSnapshot;
  return { service, settings, project, admin, probed, summary, snapshot, close: () => store.close() };
}

test("renames and recolors through the doc and the workspace list", () => {
  const s = setup();
  const meta = s.admin.updateProject(
    { method: "updateProject", projectId: s.project.id, patch: { name: "Noyau", color: "#6366F1" } },
    REMOTE,
  );
  expect([meta.name, meta.color, meta.key]).toEqual(["Noyau", "#6366F1", "KIB"]);
  expect([s.summary()?.name, s.snapshot().meta.name]).toEqual(["Noyau", "Noyau"]);
  s.close();
});

test("the folder is local only, must exist, and is refused while runs are active", () => {
  const s = setup();
  const req = {
    method: "updateProject",
    projectId: s.project.id,
    patch: { folder: "/tmp/ok/kibo" },
  } as const;
  expect(() => s.admin.updateProject(req, REMOTE)).toThrow("FORBIDDEN");
  expect(s.probed).toEqual([]);
  expect(() => s.admin.updateProject({ ...req, patch: { folder: "/tmp/missing" } }, LOCAL_CONTEXT)).toThrow(
    "INVALID_INPUT",
  );
  expect(s.admin.updateProject(req, LOCAL_CONTEXT).folder).toBe("/tmp/ok/kibo");
  expect(s.snapshot().meta.folder).toBe("/tmp/ok/kibo");
  expect(s.summary()?.folder).toBe("/tmp/ok/kibo");
  expect(s.admin.updateProject({ ...req, patch: { folder: null } }, LOCAL_CONTEXT).folder).toBeNull();
  expect(s.snapshot().meta.folder).toBeNull();
  s.close();
  const busy = setup({ activeRuns: 1 });
  const moving = {
    method: "updateProject",
    projectId: busy.project.id,
    patch: { folder: "/tmp/ok/x" },
  } as const;
  expect(() => busy.admin.updateProject(moving, LOCAL_CONTEXT)).toThrow("CONFLICT");
  expect(busy.snapshot().meta.folder).toBeNull();
  const renamed = busy.admin.updateProject(
    { method: "updateProject", projectId: busy.project.id, patch: { name: "Encore" } },
    LOCAL_CONTEXT,
  );
  expect(renamed.name).toBe("Encore");
  busy.close();
});

test("a shared project keeps its folder out of the doc", () => {
  const s = setup({ sharing: SHARED_SYNC });
  const req = {
    method: "updateProject",
    projectId: s.project.id,
    patch: { folder: "/tmp/ok/shared" },
  } as const;
  expect(s.admin.updateProject(req, LOCAL_CONTEXT).folder).toBe("/tmp/ok/shared");
  expect(s.settings.get(s.project.id, LOCAL_FOLDER_KEY)).toBe("/tmp/ok/shared");
  expect(s.service.docs.project(s.project.id).getMap("meta").get("folder")).toBeNull();
  expect(s.summary()?.folder).toBe("/tmp/ok/shared");
  s.admin.updateProject({ ...req, patch: { folder: null } }, LOCAL_CONTEXT);
  expect(s.settings.get(s.project.id, LOCAL_FOLDER_KEY)).toBeNull();
  expect(s.summary()?.folder).toBeNull();
  s.close();
});

test("a read-only shared project refuses doc fields but accepts its local folder", () => {
  const s = setup({ sharing: SHARED_SYNC });
  s.service.docs.setWriteGuard(() => {
    throw new KiboError("FORBIDDEN", "read-only project");
  });
  const update = (patch: { name?: string; folder?: string }) =>
    s.admin.updateProject({ method: "updateProject", projectId: s.project.id, patch }, LOCAL_CONTEXT);
  expect(() => update({ name: "Noyau" })).toThrow("FORBIDDEN");
  expect(s.summary()?.name).toBe("Kibo");
  expect(s.service.docs.project(s.project.id).getMap("meta").get("name")).toBe("Kibo");
  expect(update({ folder: "/tmp/ok/x" }).folder).toBe("/tmp/ok/x");
  expect(s.settings.get(s.project.id, LOCAL_FOLDER_KEY)).toBe("/tmp/ok/x");
  expect(s.service.docs.project(s.project.id).getMap("meta").get("folder")).toBeNull();
  s.close();
});

test("a local project drops a folder left in the settings so the doc is the truth", () => {
  const s = setup();
  s.settings.set(s.project.id, LOCAL_FOLDER_KEY, "/tmp/ok/before");
  expect(s.snapshot().meta.folder).toBe("/tmp/ok/before");
  s.admin.updateProject(
    { method: "updateProject", projectId: s.project.id, patch: { folder: null } },
    LOCAL_CONTEXT,
  );
  expect(s.settings.get(s.project.id, LOCAL_FOLDER_KEY)).toBeNull();
  expect(s.snapshot().meta.folder).toBeNull();
  s.close();
});

test("an unknown project, an empty name or an empty patch is refused", () => {
  const s = setup();
  expect(() =>
    s.admin.updateProject(
      { method: "updateProject", projectId: "nope", patch: { name: "x" } },
      LOCAL_CONTEXT,
    ),
  ).toThrow("NOT_FOUND");
  expect(() =>
    s.admin.updateProject(
      { method: "updateProject", projectId: s.project.id, patch: { name: "   " } },
      LOCAL_CONTEXT,
    ),
  ).toThrow("INVALID_INPUT");
  expect(() =>
    s.admin.updateProject({ method: "updateProject", projectId: s.project.id, patch: {} }, LOCAL_CONTEXT),
  ).toThrow("INVALID_INPUT");
  expect(s.summary()?.name).toBe("Kibo");
  s.close();
});

test("setIcon stores a verified image for a project or the workspace, and null removes it", () => {
  const s = setup();
  const seen: unknown[] = [];
  s.service.onChange((m) => seen.push(m));
  const owner = { kind: "project", projectId: s.project.id } as const;
  const { icon } = s.admin.setIcon({ method: "setIcon", owner, icon: { mime: "image/png", data: PNG } });
  expect(icon).toMatch(/^[0-9a-f]{64}$/);
  expect(s.summary()?.icon).toBe(icon);
  expect(seen).toEqual([{ projectId: s.project.id }, { projectId: null }]);
  expect(() =>
    s.admin.setIcon({ method: "setIcon", owner, icon: { mime: "image/jpeg", data: PNG } }),
  ).toThrow("INVALID_INPUT");
  expect(s.summary()?.icon).toBe(icon);
  expect(seen).toHaveLength(2);
  const workspace = s.admin.setIcon({
    method: "setIcon",
    owner: { kind: "workspace" },
    icon: { mime: "image/png", data: PNG },
  });
  expect(workspace.icon).toBe(icon);
  expect(seen.at(-1)).toEqual({ topic: "config" });
  expect(s.admin.setIcon({ method: "setIcon", owner, icon: null }).icon).toBeNull();
  expect(s.summary()?.icon).toBeNull();
  expect(() =>
    s.admin.setIcon({ method: "setIcon", owner: { kind: "project", projectId: "nope" }, icon: null }),
  ).toThrow("NOT_FOUND");
  s.close();
});

test("the handler answers its two methods and leaves the rest alone", async () => {
  const s = setup();
  expect(await s.admin.handler({ method: "listProjects" }, LOCAL_CONTEXT)).toEqual({ handled: false });
  const out = await s.admin.handler(
    { method: "updateProject", projectId: s.project.id, patch: { name: "Via handler" } },
    LOCAL_CONTEXT,
  );
  expect(out).toMatchObject({ handled: true, result: { name: "Via handler" } });
  s.close();
});

test("the inbox cannot be renamed, given an icon or deleted, and nothing changes", () => {
  const s = setup();
  s.service.handle({
    method: "command",
    projectId: INBOX_ID,
    command: { method: "createTicket", title: "T" },
  });
  const seen: unknown[] = [];
  s.service.onChange((m) => seen.push(m));
  const inbox = () => s.service.handle({ method: "getProject", projectId: INBOX_ID }) as ProjectSnapshot;
  const before = inbox();
  const owner = { kind: "project", projectId: INBOX_ID } as const;
  const attempts = [
    () =>
      s.admin.updateProject(
        { method: "updateProject", projectId: INBOX_ID, patch: { name: "X" } },
        LOCAL_CONTEXT,
      ),
    () =>
      s.admin.updateProject(
        { method: "updateProject", projectId: INBOX_ID, patch: { folder: "/tmp/ok" } },
        LOCAL_CONTEXT,
      ),
    () => s.admin.setIcon({ method: "setIcon", owner, icon: { mime: "image/png", data: PNG } }),
    () => s.admin.setIcon({ method: "setIcon", owner, icon: null }),
    () => s.admin.deleteProject({ method: "deleteProject", projectId: INBOX_ID }, LOCAL_CONTEXT),
  ];
  for (const attempt of attempts) expect(attempt).toThrow("is not available for the inbox");
  expect(inbox()).toEqual(before);
  expect([seen, s.probed]).toEqual([[], []]);
  expect(s.settings.get(INBOX_ID, LOCAL_FOLDER_KEY)).toBeNull();
  s.close();
});

test("an existing folder is an absolute path to a directory", () => {
  const dir = tmp();
  expect(folderIsDirectory(dir)).toBe(true);
  expect(folderIsDirectory(join(dir, "missing"))).toBe(false);
  expect(folderIsDirectory("relative/path")).toBe(false);
  const file = join(dir, "file.txt");
  writeFileSync(file, "x");
  expect(folderIsDirectory(file)).toBe(false);
  expect(folderIsDirectory(join(file, "inside"))).toBe(false);
});
