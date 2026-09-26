import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Binding,
  type Instance,
  KiboError,
  type Page,
  type ProjectMeta,
  type RpcRequest,
  type TicketView,
} from "@kibo/schema";
import { ECHO_AUTH, type FakeGithub, startFakeGithub } from "../testing/fake-github";
import { type DaemonSide, openDaemonSide } from "./testing/daemon-fixture";

let gh: FakeGithub;
let home: string;
let daemon: DaemonSide;
let project: ProjectMeta;
let binding: Binding;
let instance: Instance;
const clock = { now: Date.parse("2026-09-26T10:00:00Z") };

type Command = Extract<RpcRequest, { method: "command" }>["command"];
const sync = () => daemon.rpc({ method: "syncBinding", projectId: project.id, bindingId: binding.id });
const tickets = async (): Promise<TicketView[]> =>
  (await daemon.rpc({ method: "getProject", projectId: project.id })).tickets;
const byTitle = async (title: string) => (await tickets()).find((t) => t.title === title);
const run = (command: Command, instanceId?: string) =>
  daemon.rpc({ method: "command", projectId: project.id, command, ...(instanceId && { instanceId }) });
const issues = () => [...(gh.repos.get("adam/kibo")?.issues.values() ?? [])];
const pending = async () => (await daemon.rpc({ method: "getSyncState", projectId: project.id })).pending;

beforeEach(async () => {
  clock.now = Date.parse("2026-09-26T10:00:00Z");
  gh = startFakeGithub();
  gh.addRepo("adam/kibo");
  home = mkdtempSync(join(tmpdir(), "kibo-roundtrip-"));
  daemon = openDaemonSide(home, gh, () => clock.now);
  project = await daemon.rpc({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#71717A",
  });
  await daemon.rpc({ method: "connectGithub", auth: { mode: "token", token: gh.token } });
  binding = await daemon.rpc({
    method: "createBinding",
    projectId: project.id,
    config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  });
  const page = (await run({ method: "addPage", title: "Kanban", kind: "view" })) as Page;
  instance = (await run({
    method: "addInstance",
    pageId: page.id,
    component: "kanban@1.0.0",
    config: { source: { bindingId: binding.id } },
  })) as Instance;
});
afterEach(() => {
  daemon.close();
  gh.stop();
  rmSync(home, { recursive: true, force: true });
});

test("issue to ticket, ticket to issue, rename, description, status and close", async () => {
  gh.addIssue("adam/kibo", { title: "Depuis GitHub", body: null });
  await sync();
  const imported = await byTitle("Depuis GitHub");
  expect(imported?.externalRefs[0]).toMatchObject({ kind: "github_issue", number: 1 });

  await run({ method: "createTicket", title: "Depuis Kibo" }, instance.id);
  await sync();
  expect(issues().map((i) => i.title)).toEqual(["Depuis GitHub", "Depuis Kibo"]);
  expect((await byTitle("Depuis Kibo"))?.externalRefs[0]).toMatchObject({
    number: 2,
    url: "https://github.com/adam/kibo/issues/2",
  });

  gh.editIssue("adam/kibo", 1, { title: "Renommée sur GitHub", body: "Corps\r\nligne 2" });
  await sync();
  expect(await byTitle("Renommée sur GitHub")).toMatchObject({ description: "Corps\nligne 2" });

  const t = await byTitle("Renommée sur GitHub");
  await run({ method: "updateTicket", ticketId: t?.id ?? "", description: "Nouvelle description" });
  await run({ method: "setStatus", ticketId: t?.id ?? "", statusId: "done" });
  await sync();
  expect(issues()[0]).toMatchObject({ body: "Nouvelle description", state: "closed" });

  const before = gh.requests.length;
  await sync();
  expect(gh.requests.slice(before).filter((r) => r.method !== "GET")).toEqual([]);
});

test("offline then back: the outbox waits, a conflict is won by GitHub and reported", async () => {
  gh.addIssue("adam/kibo", { title: "A" });
  await sync();
  const t = await byTitle("A");
  gh.failNext("PATCH", /\/issues\/1$/, 503);
  await run({ method: "updateTicket", ticketId: t?.id ?? "", title: "Local" });
  gh.editIssue("adam/kibo", 1, { title: "Distant" });
  await sync();
  expect((await tickets())[0]?.title).toBe("Distant");
  expect(daemon.events).toContainEqual({
    type: "sync.conflict",
    projectId: project.id,
    ticketKey: "KIB-1",
    field: "title",
  });

  await run({ method: "setStatus", ticketId: t?.id ?? "", statusId: "done" });
  await sync();
  expect(await pending()).toEqual([t?.id ?? ""]);
  expect(gh.repos.get("adam/kibo")?.issues.get(1)?.state).toBe("open");
  clock.now += 5_000;
  await sync();
  expect(gh.repos.get("adam/kibo")?.issues.get(1)?.state).toBe("closed");
  expect(await pending()).toEqual([]);
});

test("a 403 rate limit suspends the binding until the reset", async () => {
  gh.rate.remaining = 0;
  gh.addIssue("adam/kibo", { title: "A" });
  await expect(sync()).rejects.toThrow("RATE_LIMITED");
  const before = gh.requests.length;
  await expect(sync()).rejects.toThrow("RATE_LIMITED");
  expect(gh.requests.length).toBe(before);
  const statuses = await daemon.rpc({ method: "listIntegrations" });
  expect(statuses.find((s) => s.id === "github-issues")?.resumeAt).toBe(gh.rate.reset * 1000);
});

test("the proxy injects the token for the adapter and it never comes back through the worker", async () => {
  gh.addIssue("adam/kibo", { title: "A" });
  await sync();
  const adapterCalls = gh.requests.filter((r) => r.path.startsWith("/repos/adam/kibo/issues"));
  expect(adapterCalls.length).toBeGreaterThan(0);
  expect(adapterCalls.every((r) => r.auth === `Bearer ${gh.token}`)).toBe(true);

  gh.failNext("GET", /^\/repos\/adam\/kibo\/issues/, 422, ECHO_AUTH);
  const error = await sync().catch((e: unknown) => e);
  expect(error).toBeInstanceOf(KiboError);
  expect(String(error)).toContain("Bearer ***");
  const state = await daemon.rpc({ method: "getSyncState", projectId: project.id });
  expect(JSON.stringify([String(error), state, daemon.events])).not.toContain(gh.token);
});
