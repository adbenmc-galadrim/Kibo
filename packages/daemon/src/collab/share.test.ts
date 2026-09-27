import { afterEach, beforeEach, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { addBinding, getBinding, getKeyAllocator, getProjectMeta, listTickets } from "@kibo/core";
import type { ProjectMeta, ProjectSummary, RpcRequest } from "@kibo/schema";
import { ProjectRoom } from "@kibo/sync-server";
import { generateKeyPair } from "@kibo/trust";
import { LoroDoc } from "loro-crdt";
import { type SyncHarness, startSyncHarness } from "../testing/sync-harness";
import {
  createProjectInvite,
  joinProject,
  type ShareDeps,
  setBindingRunner,
  setMemberRole,
  shareProject,
  unshareProject,
} from "./share";

let h: SyncHarness;
const d = (i: number) => {
  const x = h.daemons[i];
  if (!x) throw new Error("no daemon");
  return x;
};
const rpc = async (i: number, req: RpcRequest) => d(i).service.handle(req);
const deps = (i: number): ShareDeps => d(i).share;
const localProject = {
  method: "createProject",
  name: "Kibo",
  key: "KIB",
  folder: null,
  color: "#14B8A6",
} as const;

beforeEach(async () => {
  h = await startSyncHarness({ daemons: 2 });
  await h.connect(0, "Adam");
  await h.connect(1, "Léa");
});
afterEach(async () => {
  await h.stop();
});

async function sharedProject(): Promise<string> {
  const meta = (await rpc(0, { ...localProject, folder: "/Users/adam/goinfre/Kibo" })) as ProjectMeta;
  await rpc(0, {
    method: "command",
    projectId: meta.id,
    command: { method: "createTicket", title: "Schéma", assignee: { kind: "human", ref: "adam" } },
  });
  await shareProject(deps(0), meta.id);
  return meta.id;
}

function serverBytes(): Buffer {
  const dir = h.server.dataDir;
  return Buffer.concat(
    readdirSync(dir)
      .filter((f) => f.startsWith("sync.db"))
      .map((f) => readFileSync(join(dir, f))),
  );
}

test("nothing leaves the machine before the project is shared", async () => {
  const meta = (await rpc(0, { ...localProject, folder: "/Users/adam/goinfre/Kibo" })) as ProjectMeta;
  await rpc(0, {
    method: "command",
    projectId: meta.id,
    command: { method: "createTicket", title: "Secret local" },
  });
  await Bun.sleep(100);
  expect(serverBytes().includes(Buffer.from("Secret local"))).toBe(false);
  expect(d(0).client.status().projects).toEqual([]);
});

test("the snapshot sent to the server has no local folder and migrated assignees", async () => {
  const p = await sharedProject();
  const room = ProjectRoom.load(h.server.server.sdb, p);
  const json = JSON.stringify(LoroDoc.fromSnapshot(room.snapshotBytes()).toJSON());
  expect(json).not.toContain("/Users/adam");
  const adamId = d(0).client.status().user?.id ?? "";
  expect(json).toContain(adamId);
  expect(json).not.toContain('"ref":"adam"');
  const snap = (await rpc(0, { method: "getProject", projectId: p })) as { meta: ProjectMeta };
  expect(snap.meta.folder).toBe("/Users/adam/goinfre/Kibo");
  const listed = (await rpc(0, { method: "listProjects" })) as ProjectSummary[];
  expect(listed.find((x) => x.id === p)?.folder).toBe("/Users/adam/goinfre/Kibo");
  expect(getProjectMeta(d(0).hosts.host(p).doc()).folder).toBeNull();
});

test("no fake secret ever reaches the server", async () => {
  await d(0).secrets.set("github", "ghp_TESTSECRET000");
  const publisher = await generateKeyPair();
  await d(0).secrets.set("market:publisher", JSON.stringify({ name: "Adam", ...publisher }));
  const p = await sharedProject();
  const code = await createProjectInvite(deps(0), { projectId: p, role: "editor" });
  await joinProject(deps(1), { code: code.code, folder: null });
  await rpc(1, { method: "command", projectId: p, command: { method: "createTicket", title: "Depuis Léa" } });
  await h.waitUntil(() => listTickets(d(0).hosts.host(p).doc()).length === 2);
  const device = JSON.parse((await d(0).secrets.get("sync:device")) ?? "{}") as { privateKey: string };
  const bytes = serverBytes();
  expect(bytes.includes(Buffer.from("ghp_TESTSECRET000"))).toBe(false);
  for (const key of [device.privateKey, publisher.privateKey]) {
    expect(key.length).toBeGreaterThan(0);
    expect(bytes.includes(Buffer.from(key))).toBe(false);
    expect(bytes.includes(Buffer.from(key, "base64"))).toBe(false);
  }
});

test("a share retried after a dropped connection is idempotent", async () => {
  const meta = (await rpc(0, localProject)) as ProjectMeta;
  const first = shareProject(deps(0), meta.id);
  h.server.server.hub.kickDevice(d(0).client.status().deviceId ?? "", 1011);
  await first.catch((e: unknown) => expect(e).toMatchObject({ code: "SYNC_OFFLINE" }));
  await h.waitUntil(() => d(0).client.status().state === "online", 30_000);
  const info = await shareProject(deps(0), meta.id);
  expect(info.shared).toBe(true);
  expect(((await rpc(0, { method: "listProjects" })) as unknown[]).length).toBe(1);
  await rpc(0, {
    method: "command",
    projectId: meta.id,
    command: { method: "createTicket", title: "Après" },
  });
  await h.waitUntil(() => listTickets(d(0).hosts.host(meta.id).doc()).some((t) => t.key !== null));
}, 40_000);

test("commands wait out a share in progress with CONFLICT", async () => {
  const meta = (await rpc(0, localProject)) as ProjectMeta;
  const sharing = shareProject(deps(0), meta.id);
  await expect(
    rpc(0, { method: "command", projectId: meta.id, command: { method: "createTicket", title: "Pendant" } }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(shareProject(deps(0), meta.id)).rejects.toMatchObject({ code: "CONFLICT" });
  await sharing;
  await rpc(0, {
    method: "command",
    projectId: meta.id,
    command: { method: "createTicket", title: "Après" },
  });
});

test("an editor joins and sees the tickets; the owner can remove her", async () => {
  const p = await sharedProject();
  const { code } = await createProjectInvite(deps(0), { projectId: p, role: "editor" });
  const meta = await joinProject(deps(1), { code: `  ${code.toLowerCase()} `, folder: "/Users/lea/Kibo" });
  expect(meta.key).toBe("KIB");
  expect(listTickets(d(1).hosts.host(p).doc()).map((t) => t.title)).toEqual(["Schéma"]);
  const snap = (await rpc(1, { method: "getProject", projectId: p })) as { meta: ProjectMeta };
  expect(snap.meta.folder).toBe("/Users/lea/Kibo");
  const leaId = d(1).client.status().user?.id ?? "";
  const members = await setMemberRole(deps(0), { projectId: p, userId: leaId, role: null });
  expect(members.map((m) => m.userId)).not.toContain(leaId);
  await h.waitUntil(() =>
    d(1)
      .client.status()
      .projects.some((x) => x.projectId === p && x.accessRevoked),
  );
  await expect(
    rpc(1, { method: "command", projectId: p, command: { method: "createTicket", title: "Non" } }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

test("a viewer joins read-only", async () => {
  const p = await sharedProject();
  const { code } = await createProjectInvite(deps(0), { projectId: p, role: "viewer" });
  await joinProject(deps(1), { code, folder: null });
  await expect(
    rpc(1, { method: "command", projectId: p, command: { method: "createTicket", title: "Non" } }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

test("only an owner invites", async () => {
  const p = await sharedProject();
  const { code } = await createProjectInvite(deps(0), { projectId: p, role: "editor" });
  await joinProject(deps(1), { code, folder: null });
  await expect(createProjectInvite(deps(1), { projectId: p, role: "editor" })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});

test("joining a project whose key is already used locally fails clearly", async () => {
  const p = await sharedProject();
  await rpc(1, { method: "createProject", name: "Autre", key: "KIB", folder: null, color: "#14B8A6" });
  const { code } = await createProjectInvite(deps(0), { projectId: p, role: "editor" });
  await expect(joinProject(deps(1), { code, folder: null })).rejects.toMatchObject({
    code: "INVALID_INPUT",
    detail: "duplicate project key KIB",
  });
  expect(
    d(1)
      .client.status()
      .projects.some((x) => x.projectId === p),
  ).toBe(false);
});

test("an editor who does not own a binding cannot take its runner", async () => {
  const p = await sharedProject();
  const adamId = d(0).client.status().user?.id ?? "";
  d(0).hosts.mutate(p, (doc) => {
    addBinding(doc, {
      id: "b1",
      adapter: "github-issues",
      config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
      createdBy: adamId,
      runner: adamId,
    });
  });
  const { code } = await createProjectInvite(deps(0), { projectId: p, role: "editor" });
  await joinProject(deps(1), { code, folder: null });
  await h.waitUntil(() => d(1).hosts.host(p).doc().getMap("bindings").get("b1") !== undefined);
  expect(() => setBindingRunner(deps(1), { projectId: p, bindingId: "b1" })).toThrow("FORBIDDEN");
  setBindingRunner(deps(0), { projectId: p, bindingId: "b1" });
  expect(getBinding(d(0).hosts.host(p).doc(), "b1").runner).toBe(adamId);
});

test("the local identity of a shared project is the account, not the OS user", async () => {
  const p = await sharedProject();
  const unshared = (await rpc(0, { ...localProject, name: "Perso", key: "PER" })) as ProjectMeta;
  expect(d(0).service.docs.identity(p)).toBe(d(0).client.status().user?.id ?? "");
  expect(d(0).service.docs.identity(unshared.id)).toBe("adam");
});

test("an unshared project gets its keys back from the daemon and can be shared again", async () => {
  const p = await sharedProject();
  await h.waitUntil(() => getKeyAllocator(d(0).hosts.host(p).doc()) === "server");
  await unshareProject(deps(0), p);
  expect(getKeyAllocator(d(0).hosts.host(p).doc())).toBe("local");
  expect(d(0).client.status().projects).toEqual([]);
  const created = (await rpc(0, {
    method: "command",
    projectId: p,
    command: { method: "createTicket", title: "Local" },
  })) as { key: string | null };
  expect(created.key).toBe("KIB-2");
  const info = await shareProject(deps(0), p);
  expect(info.shared).toBe(true);
});
