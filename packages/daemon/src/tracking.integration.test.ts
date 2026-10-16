import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type { ProjectCommand, RpcRequest } from "@kibo/schema";
import { z } from "zod";
import { createGitFixture, installFakeGh } from "./code/testing/git-fixture";
import { fakeBuild, okReport } from "./components/service.test-helper";
import { type Daemon, type DaemonOptions, startDaemon } from "./daemon";

const FIXED_NOW = "2026-10-16T14:52:00+02:00";
const BRANCH = "feat/emis-1-x";
const PR_URL = "https://github.com/kibo/test/pull/1";

const Answer = z.object({ ok: z.boolean(), result: z.unknown() });
const Created = z.object({ id: z.string() });
const Snapshot = z.object({
  tickets: z.array(
    z.object({
      key: z.string(),
      statusId: z.string(),
      shortKey: z.string().nullable(),
      externalRefs: z.array(z.object({ kind: z.string() }).passthrough()),
      feature: z.object({ status: z.string() }).nullable(),
    }),
  ),
  pages: z.array(z.object({ title: z.string() })),
});
type Snapshot = z.infer<typeof Snapshot>;
const ConfigMessage = z.object({ topic: z.literal("config") });

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const clean of cleanups.splice(0).reverse()) await clean();
});

type Client = { daemon: Daemon; rpc(req: RpcRequest): Promise<unknown>; events: unknown[] };

async function launch(home: string, extra: Partial<DaemonOptions> = {}): Promise<Client> {
  const previous = process.env.KIBO_FIXED_NOW;
  process.env.KIBO_FIXED_NOW = FIXED_NOW;
  const started = startDaemon({
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    build: fakeBuild,
    validate: okReport,
    home,
    ...extra,
  });
  const daemon = await started.finally(() => {
    if (previous === undefined) delete process.env.KIBO_FIXED_NOW;
    else process.env.KIBO_FIXED_NOW = previous;
  });
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    await daemon.stop();
  };
  cleanups.push(stop);
  const headers = { "content-type": "application/json", origin: daemon.url };
  const paired = await fetch(`${daemon.url}/api/pair`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token: daemon.token }),
  });
  const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
  const events: unknown[] = [];
  const ws = new WebSocket(`${daemon.url.replace("http", "ws")}/api/events`, {
    headers: { origin: daemon.url, cookie },
  });
  ws.onmessage = (e) => events.push(JSON.parse(String(e.data)));
  await new Promise((resolve) => {
    ws.onopen = resolve;
  });
  cleanups.push(() => ws.close());
  const rpc = async (req: RpcRequest): Promise<unknown> => {
    const res = await fetch(`${daemon.url}/api/rpc`, {
      method: "POST",
      headers: { ...headers, cookie },
      body: JSON.stringify(req),
    });
    const answer = Answer.parse(await res.json());
    if (!answer.ok) throw new Error(`rpc ${req.method} failed: ${JSON.stringify(answer)}`);
    return answer.result;
  };
  return { daemon: { ...daemon, stop }, rpc, events };
}

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "kibo-tracking-"));
  cleanups.push(() => rmSync(home, { recursive: true, force: true }));
  return home;
}

async function until<T>(read: () => Promise<T | undefined>, what: string, ms = 15_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > end) throw new Error(`${what} not reached in time`);
    await Bun.sleep(50);
  }
}

function project(client: Client, projectId: string) {
  const command = (cmd: ProjectCommand) => client.rpc({ method: "command", projectId, command: cmd });
  const create = async (cmd: ProjectCommand) => Created.parse(await command(cmd)).id;
  const snapshot = async () => Snapshot.parse(await client.rpc({ method: "getProject", projectId }));
  const ticket = (snap: Snapshot, key: string) => {
    const found = snap.tickets.find((t) => t.key === key);
    if (!found) throw new Error(`no ticket ${key}`);
    return found;
  };
  const reaches = (key: string, statusId: string) =>
    until(async () => {
      const snap = await snapshot();
      return ticket(snap, key).statusId === statusId ? snap : undefined;
    }, `${key} ${statusId}`);
  return { command, create, snapshot, ticket, reaches };
}

async function createProject(client: Client, folder: string | null): Promise<string> {
  const created = await client.rpc({
    method: "createProject",
    name: "Emis",
    key: "EMIS",
    folder,
    color: "#F97316",
  });
  return Created.parse(created).id;
}

test("a branch, then its PR, then its merge move the ticket and deliver its feature", async () => {
  const fx = createGitFixture({ remote: false });
  cleanups.push(() => fx.cleanup());
  fx.commit("chore: init", { "README.md": "# emis\n" });
  const gh = installFakeGh(fx.dir);
  const client = await launch(tempHome(), { code: { env: { ...fx.env, ...gh }, prPollMs: 50 } });
  const emis = project(client, await createProject(client, fx.repo));
  const step = await emis.create({ method: "createTicket", title: "Connexion", statusId: "todo" });
  const feature = await emis.create({ method: "createTicket", title: "Accès" });
  await emis.command({ method: "moveTicket", ticketId: step, parentId: feature, index: 0 });
  const demo = await emis.create({ method: "createTicket", title: "Démo client", parentId: feature });
  await emis.command({ method: "setStatus", ticketId: demo, statusId: "todo" });
  await emis.command({ method: "setTicketOptional", ticketId: demo, optional: true });

  fx.git("worktree", "add", "-q", "-b", BRANCH, join(fx.dir, "emis-1-x"));
  const started = await emis.reaches("EMIS-1", "in_progress");
  expect(emis.ticket(started, "EMIS-1").externalRefs).toContainEqual({
    kind: "git_branch",
    branch: BRANCH,
    base: null,
  });

  const pr = (state: "OPEN" | "MERGED") =>
    writeFileSync(
      gh.FAKE_GH_STATE ?? "",
      JSON.stringify([{ number: 1, url: PR_URL, state, isDraft: false, head: BRANCH, base: "main" }]),
    );
  pr("OPEN");
  await emis.reaches("EMIS-1", "in_review");
  pr("MERGED");
  const merged = await emis.reaches("EMIS-1", "done");
  expect(emis.ticket(merged, "EMIS-2").feature?.status).toBe("delivered");
  expect(emis.ticket(merged, "EMIS-3").statusId).toBe("todo");
});

test("changing an app setting tells every client to reload the configuration", async () => {
  const client = await launch(tempHome());
  await client.rpc({ method: "setAppSettings", patch: { agentExecution: "shown" } });
  const isConfig = (e: unknown) => ConfigMessage.safeParse(e).success;
  await until(async () => client.events.find(isConfig), "config message");
});

test("an imported plan key becomes the feature's short key and a Planning page, once", async () => {
  const home = tempHome();
  const first = await launch(home);
  const projectId = await createProject(first, null);
  const seeded = project(first, projectId);
  const feature = await seeded.create({ method: "createTicket", title: "Accès" });
  await seeded.command({
    method: "upsertExternalRef",
    ticketId: feature,
    ref: { kind: "import_ref", source: "plan", id: "C4" },
  });
  await seeded.command({ method: "createTicket", title: "Connexion", parentId: feature });
  await seeded.command({ method: "updateTicket", ticketId: feature, shortKey: null });
  await first.daemon.stop();

  for (let start = 0; start < 2; start += 1) {
    const client = await launch(home);
    const snap = await project(client, projectId).snapshot();
    expect(project(client, projectId).ticket(snap, "EMIS-1").shortKey).toBe("C4");
    expect(snap.pages.filter((p) => p.title === "Planning")).toHaveLength(1);
    await client.daemon.stop();
  }
});
