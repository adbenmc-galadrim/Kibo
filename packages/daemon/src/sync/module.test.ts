import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Instance, Page, ProjectMeta, RpcRequest } from "@kibo/schema";
import { type FakeGithub, startFakeGithub } from "../testing/fake-github";
import { type DaemonSide, openDaemonSide } from "./testing/daemon-fixture";

let gh: FakeGithub;
let home: string;
let daemon: DaemonSide;
let project: ProjectMeta;

type Command = Extract<RpcRequest, { method: "command" }>["command"];
const run = (command: Command, instanceId?: string) =>
  daemon.rpc({ method: "command", projectId: project.id, command, ...(instanceId && { instanceId }) });
const bind = (repo: string) =>
  daemon.rpc({
    method: "createBinding",
    projectId: project.id,
    config: { repo, project: null, importClosed: false, labels: [] },
  });
const syncState = () => daemon.rpc({ method: "getSyncState", projectId: project.id });

async function until(check: () => Promise<boolean>, ms = 3_000): Promise<void> {
  const end = Date.now() + ms;
  while (!(await check())) {
    if (Date.now() > end) throw new Error("condition not met in time");
    await Bun.sleep(50);
  }
}

beforeEach(async () => {
  gh = startFakeGithub();
  gh.addRepo("adam/kibo");
  gh.addRepo("adam/site");
  home = mkdtempSync(join(tmpdir(), "kibo-sync-module-"));
  daemon = openDaemonSide(home, gh, () => Date.now());
  project = await daemon.rpc({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#71717A",
  });
  await daemon.rpc({ method: "connectGithub", auth: { mode: "token", token: gh.token } });
});
afterEach(() => {
  daemon.close();
  gh.stop();
  rmSync(home, { recursive: true, force: true });
});

test("a repo already bound in the project is refused, another repo is not", async () => {
  await bind("adam/kibo");
  await expect(bind("Adam/Kibo")).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(bind("adam/site")).resolves.toMatchObject({ config: { repo: "adam/site" } });
  expect((await syncState()).bindings.map((b) => b.repo).sort()).toEqual(["adam/kibo", "adam/site"]);
});

test("the sync state says whether GitHub is connected", async () => {
  expect((await syncState()).connected).toBe(true);
  await daemon.rpc({ method: "disconnectIntegration", id: "github" });
  expect((await syncState()).connected).toBe(false);
});

test("dropping a failed send relaunches the queue behind it", async () => {
  const binding = await bind("adam/kibo");
  await daemon.rpc({ method: "syncBinding", projectId: project.id, bindingId: binding.id });
  const page = (await run({ method: "addPage", title: "Kanban", kind: "view" })) as Page;
  const instance = (await run({
    method: "addInstance",
    pageId: page.id,
    component: "kanban@1.0.0",
    config: { source: { bindingId: binding.id } },
  })) as Instance;
  gh.failNext("POST", /\/issues$/, 422, JSON.stringify({ message: "Validation Failed" }));
  await run({ method: "createTicket", title: "Refusée" }, instance.id);
  await run({ method: "createTicket", title: "Suivante" }, instance.id);
  await until(async () => (await syncState()).errors.length > 0);
  await Bun.sleep(1_200);
  const { errors, pending } = await syncState();
  const [failed] = errors;
  expect(failed?.code).toBe("REMOTE_REJECTED");
  expect(pending).toHaveLength(2);
  await daemon.rpc({
    method: "resolveOutbox",
    projectId: project.id,
    outboxId: failed?.outboxId ?? 0,
    action: "drop",
  });
  await until(async () => (await syncState()).pending.length === 0);
  expect([...(gh.repos.get("adam/kibo")?.issues.values() ?? [])].map((i) => i.title)).toEqual(["Suivante"]);
  expect(daemon.events).toContainEqual({ type: "sync.outbox", projectId: project.id, bindingId: binding.id });
}, 10_000);
