import { afterEach, beforeEach, expect, test } from "bun:test";
import type { ProjectMeta, ProjectSummary, RpcRequest, ServerFrame } from "@kibo/schema";
import { shareProject, unshareProject } from "../collab/share";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { type SyncHarness, startSyncHarness } from "../testing/sync-harness";
import { createProjectAdmin } from "./admin";

let h: SyncHarness;
const d = (i: number) => {
  const x = h.daemons[i];
  if (!x) throw new Error("no daemon");
  return x;
};
const rpc = async (i: number, req: RpcRequest) => d(i).service.handle(req);
const ids = async (i: number) =>
  ((await rpc(i, { method: "listProjects" })) as ProjectSummary[]).map((p) => p.id);
const adminOf = (i: number) =>
  createProjectAdmin({
    docs: d(i).service.docs,
    settings: d(i).share.settings,
    icons: d(i).service.icons,
    store: { transaction: (fn) => fn() },
    sharing: (projectId) => d(i).share.syncInfo(projectId),
    activeRuns: () => 0,
    detach: (projectId) => d(i).client.detachProject(projectId),
    isLocked: (projectId) => d(i).hosts.isLocked(projectId),
  });
const remove = (i: number, projectId: string) =>
  adminOf(i).deleteProject({ method: "deleteProject", projectId }, LOCAL_CONTEXT);

beforeEach(async () => {
  h = await startSyncHarness({ daemons: 2 });
  await h.connect(0, "Adam");
  await h.connect(1, "Léa");
});
afterEach(async () => {
  await h.stop();
});

async function sharedProject(): Promise<string> {
  const meta = (await rpc(0, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#14B8A6",
  })) as ProjectMeta;
  await shareProject(d(0).share, meta.id);
  return meta.id;
}

test("a member who deletes the project leaves it; the owner keeps it and cannot delete it while shared", async () => {
  const id = await sharedProject();
  const code = await h.inviteRaw(0, id, "editor");
  await h.joinRaw(1, code);
  await h.waitUntil(() =>
    d(1)
      .client.status()
      .projects.some((p) => p.projectId === id && p.lastSyncAt !== null),
  );
  const sent: ServerFrame[] = [];
  d(1).client.onFrame((f) => {
    if ("projectId" in f && f.projectId === id) sent.push(f);
  });

  expect(remove(1, id)).toBeNull();
  expect(await ids(1)).toEqual([]);
  expect(d(1).client.status().projects).toEqual([]);
  expect(d(1).syncDb.project(id)).toBeNull();

  expect(() => remove(0, id)).toThrow("CONFLICT");
  expect(await ids(0)).toEqual([id]);
  expect(d(0).syncDb.project(id)).not.toBeNull();
  await rpc(0, {
    method: "command",
    projectId: id,
    command: { method: "createTicket", title: "Après départ" },
  });
  await h.waitUntil(() =>
    d(0)
      .client.status()
      .projects.some((p) => p.projectId === id && p.lastError === null),
  );
  await Bun.sleep(100);
  expect(sent.filter((f) => f.type === "update")).toEqual([]);
  expect(await ids(1)).toEqual([]);

  await unshareProject(d(0).share, id);
  expect(remove(0, id)).toBeNull();
  expect(await ids(0)).toEqual([]);
});

test("a viewer can leave too, though it cannot write", async () => {
  const id = await sharedProject();
  await h.joinRaw(1, await h.inviteRaw(0, id, "viewer"));
  expect(d(1).share.syncInfo(id).access).toBe("read-only");
  expect(remove(1, id)).toBeNull();
  expect(await ids(1)).toEqual([]);
  expect(d(1).syncDb.project(id)).toBeNull();
  expect(await ids(0)).toEqual([id]);
});
