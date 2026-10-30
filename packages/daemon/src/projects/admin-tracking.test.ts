import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError, type ProjectMeta, type ProjectSnapshot } from "@kibo/schema";
import { createProjectSettings } from "../notes/settings";
import { LOCAL_CONTEXT, type RpcContext } from "../rpc-extensions";
import { createService } from "../service";
import { openStore } from "../store";
import { createProjectAdmin } from "./admin";

const REMOTE: RpcContext = { sessionHash: "r", remote: true };
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "kibo-admin-tracking-"));
  dirs.push(dir);
  const store = openStore(dir);
  const service = createService(store, { user: "adam" });
  const project = service.handle({
    method: "createProject",
    name: "Silo",
    key: "SILO",
    folder: null,
    color: "#F97316",
  }) as ProjectMeta;
  const admin = createProjectAdmin({
    docs: service.docs,
    settings: createProjectSettings(store.db),
    icons: service.icons,
    store,
    activeRuns: () => 0,
  });
  const update = (tracking: { openLimit: number } | null, ctx: RpcContext = LOCAL_CONTEXT) =>
    admin.updateProject({ method: "updateProject", projectId: project.id, patch: { tracking } }, ctx);
  const snapshot = () => service.handle({ method: "getProject", projectId: project.id }) as ProjectSnapshot;
  return { service, project, update, snapshot, close: () => store.close() };
}

test("the open limit is written to the project doc, synced, and can be cleared", () => {
  const s = setup();
  expect(s.update({ openLimit: 3 }, REMOTE).tracking).toEqual({ openLimit: 3 });
  expect(s.snapshot().meta.tracking).toEqual({ openLimit: 3 });
  expect(s.service.docs.project(s.project.id).getMap("meta").get("tracking")).toEqual({ openLimit: 3 });
  expect(JSON.stringify(s.service.docs.workspace.toJSON())).not.toContain("openLimit");
  expect(s.update(null).tracking).toBeNull();
  s.close();
});

test("an open limit out of range or on a read-only project is refused", () => {
  const s = setup();
  expect(() => s.update({ openLimit: 0 })).toThrow("INVALID_INPUT");
  s.service.docs.setWriteGuard(() => {
    throw new KiboError("FORBIDDEN", "read-only project");
  });
  expect(() => s.update({ openLimit: 4 })).toThrow("FORBIDDEN");
  expect(s.snapshot().meta.tracking).toBeNull();
  s.close();
});
