import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Binding, Instance, Page, ProjectMeta, RpcRequest } from "@kibo/schema";
import { type FakeGithub, startFakeGithub } from "../testing/fake-github";
import { type DaemonSide, openDaemonSide } from "./testing/daemon-fixture";

let gh: FakeGithub;
let home: string;
let daemon: DaemonSide;
let project: ProjectMeta;
let binding: Binding;
const clock = { now: Date.parse("2026-09-26T10:00:00Z") };

type Command = Extract<RpcRequest, { method: "command" }>["command"];
const open = () => {
  daemon = openDaemonSide(home, gh, () => clock.now);
  return daemon.rpc({ method: "connectGithub", auth: { mode: "token", token: gh.token } });
};
const sync = () => daemon.rpc({ method: "syncBinding", projectId: project.id, bindingId: binding.id });
const run = (command: Command, instanceId?: string) =>
  daemon.rpc({ method: "command", projectId: project.id, command, ...(instanceId && { instanceId }) });
const titles = async () =>
  (await daemon.rpc({ method: "getProject", projectId: project.id })).tickets.map((t) => t.title).sort();
const issues = () => [...(gh.repos.get("adam/kibo")?.issues.values() ?? [])];

beforeEach(async () => {
  clock.now = Date.parse("2026-09-26T10:00:00Z");
  gh = startFakeGithub();
  gh.addRepo("adam/kibo");
  home = mkdtempSync(join(tmpdir(), "kibo-restart-"));
  await open();
  project = await daemon.rpc({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#71717A",
  });
  binding = await daemon.rpc({
    method: "createBinding",
    projectId: project.id,
    config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  });
});
afterEach(() => {
  daemon.close();
  gh.stop();
  rmSync(home, { recursive: true, force: true });
});

test("a cold restart resumes the outbox and the cursor without duplicate nor loss", async () => {
  gh.addIssue("adam/kibo", { title: "Avant l'arrêt" });
  await sync();
  const page = (await run({ method: "addPage", title: "Kanban", kind: "view" })) as Page;
  const instance = (await run({
    method: "addInstance",
    pageId: page.id,
    component: "kanban@1.0.0",
    config: { source: { bindingId: binding.id } },
  })) as Instance;
  await run({ method: "createTicket", title: "Fermé dans Kibo", statusId: "done" }, instance.id);
  gh.failNext("PATCH", /\/issues\/2$/, 503);
  expect(await sync()).toMatchObject({ pushed: 0 });
  expect(issues().map((i) => [i.number, i.state])).toEqual([
    [1, "open"],
    [2, "open"],
  ]);
  daemon.close();

  gh.addIssue("adam/kibo", { title: "Pendant l'arrêt" });
  await open();
  expect((await daemon.rpc({ method: "getSyncState", projectId: project.id })).pending).toHaveLength(1);
  clock.now += 5_000;
  await sync();

  expect(issues().map((i) => [i.title, i.state])).toEqual([
    ["Avant l'arrêt", "open"],
    ["Fermé dans Kibo", "closed"],
    ["Pendant l'arrêt", "open"],
  ]);
  expect(await titles()).toEqual(["Avant l'arrêt", "Fermé dans Kibo", "Pendant l'arrêt"]);
  const closed = (await daemon.rpc({ method: "getProject", projectId: project.id })).tickets.find(
    (t) => t.title === "Fermé dans Kibo",
  );
  expect(closed?.externalRefs[0]).toMatchObject({ number: 2, url: "https://github.com/adam/kibo/issues/2" });
  expect((await daemon.rpc({ method: "getSyncState", projectId: project.id })).pending).toEqual([]);

  const before = gh.requests.length;
  await sync();
  expect(gh.requests.slice(before).filter((r) => r.method !== "GET")).toEqual([]);
  expect(await titles()).toHaveLength(3);
});
