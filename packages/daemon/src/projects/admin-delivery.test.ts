import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EMPTY_DELIVERY, type ProjectMeta, type ProjectSyncInfo } from "@kibo/schema";
import { createProjectSettings } from "../notes/settings";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { createService } from "../service";
import { openStore } from "../store";
import { createProjectAdmin } from "./admin";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const SYNC: ProjectSyncInfo = {
  shared: false,
  keyAllocator: "local",
  role: null,
  access: "write",
  members: [],
};

test("delivery settings are written only from this machine", () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-admin-delivery-"));
  dirs.push(dir);
  const store = openStore(dir);
  const service = createService(store, { user: "adam" });
  const project = service.handle({
    method: "createProject",
    name: "Emis",
    key: "EMIS",
    folder: null,
    color: "#F97316",
  }) as ProjectMeta;
  const admin = createProjectAdmin({
    docs: service.docs,
    settings: createProjectSettings(store.db),
    icons: service.icons,
    store,
    sharing: () => SYNC,
    activeRuns: () => 0,
    detach: () => {},
    isLocked: () => false,
  });
  const delivery = { ...EMPTY_DELIVERY, idPattern: "^C[0-9]+$" };
  const update = (ctx = LOCAL_CONTEXT) =>
    admin.updateProject({ method: "updateProject", projectId: project.id, patch: { delivery } }, ctx);
  expect(() => update({ sessionHash: "r", remote: true })).toThrow("FORBIDDEN");
  expect(update().delivery).toEqual(delivery);
  store.close();
});
