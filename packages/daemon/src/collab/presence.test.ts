import { afterEach, beforeEach, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProjectMeta, RpcRequest } from "@kibo/schema";
import { type SyncHarness, startSyncHarness } from "../testing/sync-harness";
import { presenceRuns } from "./presence";
import { createProjectInvite, joinProject, shareProject } from "./share";

let h: SyncHarness;
let project: string;
const ctx = { sessionHash: "t", remote: false };
const d = (i: number) => {
  const x = h.daemons[i];
  if (!x) throw new Error("no daemon");
  return x;
};
const rpc = async (i: number, req: RpcRequest) => {
  const out = await d(i).handler(req, ctx);
  return out.handled ? out.result : d(i).service.handle(req);
};

async function start(presenceTimeoutMs?: number): Promise<void> {
  h = await startSyncHarness(
    presenceTimeoutMs === undefined ? { daemons: 3 } : { daemons: 3, presenceTimeoutMs },
  );
  await h.connect(0, "Adam");
  await h.connect(1, "Léa");
  const meta = (await rpc(0, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#14B8A6",
  })) as ProjectMeta;
  project = meta.id;
  await shareProject(d(0).share, project);
  const { code } = await createProjectInvite(d(0).share, { projectId: project, role: "editor" });
  await joinProject(d(1).share, { code, folder: null });
}

beforeEach(async () => {
  await start(400);
});
afterEach(async () => {
  await h.stop();
});

test("two daemons see each other's page and ticket", async () => {
  await rpc(0, { method: "setPresence", projectId: project, pageId: "pg1", ticketId: "t1" });
  await h.waitUntil(() =>
    d(1)
      .presence.peers(project)
      .some((p) => !p.self && p.pageId === "pg1"),
  );
  const adam = d(1)
    .presence.peers(project)
    .find((p) => !p.self);
  expect(adam).toMatchObject({ name: "Adam", pageId: "pg1", ticketId: "t1", runs: [] });
  const mine = (await rpc(0, { method: "getPresence", projectId: project })) as { self: boolean }[];
  expect(mine.some((p) => p.self)).toBe(true);
});

test("a peer that stops refreshing expires", async () => {
  d(0).presence.set(project, { pageId: "pg1", ticketId: null });
  await h.waitUntil(() =>
    d(1)
      .presence.peers(project)
      .some((p) => !p.self),
  );
  d(0).client.stop();
  await Bun.sleep(800);
  d(1).presence.tick();
  expect(
    d(1)
      .presence.peers(project)
      .some((p) => !p.self),
  ).toBe(false);
});

test("a peer that disconnects is withdrawn before it expires", async () => {
  await h.stop();
  await start();
  d(0).presence.set(project, { pageId: "pg1", ticketId: null });
  await h.waitUntil(() =>
    d(1)
      .presence.peers(project)
      .some((p) => !p.self),
  );
  d(0).client.stop();
  await h.waitUntil(
    () =>
      !d(1)
        .presence.peers(project)
        .some((p) => !p.self),
    2000,
  );
});

test("a colleague's run is visible without entering the local queue", async () => {
  d(0).presence.set(project, { pageId: null, ticketId: null });
  d(0).runs.set([
    { projectId: project, ticketId: "t1", ticketKey: "KIB-12", profile: "opus-dev-1", state: "running" },
  ]);
  await h.waitUntil(() =>
    d(1)
      .presence.peers(project)
      .some((p) => p.runs.length === 1),
  );
  const adam = d(1)
    .presence.peers(project)
    .find((p) => !p.self);
  expect(adam?.runs).toEqual([{ ticketKey: "KIB-12", profile: "opus-dev-1", state: "running" }]);
  expect(d(1).runs.active()).toEqual([]);
});

test("presence is never written to disk nor to the project doc", async () => {
  const before = d(1).hosts.host(project).doc().oplogVersion().encode();
  d(0).presence.set(project, { pageId: null, ticketId: null });
  d(0).runs.set([
    {
      projectId: project,
      ticketId: "t1",
      ticketKey: "KIB-12",
      profile: "presence-marker-profile",
      state: "running",
    },
  ]);
  await h.waitUntil(() =>
    d(1)
      .presence.peers(project)
      .some((p) => p.runs.length === 1),
  );
  for (const i of [0, 1]) {
    const bytes = Buffer.concat(
      readdirSync(d(i).home)
        .filter((f) => f.startsWith("kibo.db"))
        .map((f) => readFileSync(join(d(i).home, f))),
    );
    expect(bytes.includes(Buffer.from("presence-marker-profile"))).toBe(false);
  }
  expect(d(1).hosts.host(project).doc().oplogVersion().encode()).toEqual(before);
});

test("a viewer publishes its presence like any member", async () => {
  await h.connect(2, "Sam");
  const { code } = await createProjectInvite(d(0).share, { projectId: project, role: "viewer" });
  await joinProject(d(2).share, { code, folder: null });
  await rpc(2, { method: "setPresence", projectId: project, pageId: "pg2", ticketId: null });
  await h.waitUntil(() =>
    d(0)
      .presence.peers(project)
      .some((p) => p.name === "Sam" && p.pageId === "pg2"),
  );
});

test("only live runs of the project are shown, by profile name", () => {
  const run = { projectId: "p1", ticketKey: "KIB-12", profileName: "opus-dev-1", state: "running" as const };
  expect(
    presenceRuns(
      [run, { ...run, state: "done" }, { ...run, projectId: "p2" }, { ...run, projectId: null }],
      "p1",
    ),
  ).toEqual([{ ticketKey: "KIB-12", profile: "opus-dev-1", state: "running" }]);
});

test("presence is ignored for a project that is not shared", async () => {
  const meta = (await rpc(0, {
    method: "createProject",
    name: "Solo",
    key: "SOL",
    folder: null,
    color: "#14B8A6",
  })) as ProjectMeta;
  await rpc(0, { method: "setPresence", projectId: meta.id, pageId: "pg1", ticketId: null });
  expect(d(0).presence.peers(meta.id)).toEqual([]);
});
