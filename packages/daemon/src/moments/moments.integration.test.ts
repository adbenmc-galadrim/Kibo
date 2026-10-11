import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type {
  AgentProfile,
  AgentsState,
  ProjectMeta,
  RunMoment,
  RunMomentsPage,
  RunPeek,
  RunView,
  Ticket,
} from "@kibo/schema";
import { FAKE_CLAUDE, scenarioPath } from "../agents/fake-claude-scenario";
import { type Daemon, startDaemon } from "../daemon";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

type Client = {
  rpc<T>(body: unknown): Promise<T>;
  events: unknown[];
};

async function client(d: Daemon): Promise<Client> {
  const headers = { "content-type": "application/json", origin: d.url };
  const paired = await fetch(`${d.url}/api/pair`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token: d.token }),
  });
  const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
  const events: unknown[] = [];
  const ws = new WebSocket(`${d.url.replace("http", "ws")}/api/events`, {
    headers: { origin: d.url, cookie },
  });
  ws.onmessage = (e) => events.push(JSON.parse(String(e.data)));
  await new Promise((resolve) => {
    ws.onopen = resolve;
  });
  cleanups.push(async () => ws.close());
  const rpc = async <T>(body: unknown): Promise<T> => {
    const res = await fetch(`${d.url}/api/rpc`, {
      method: "POST",
      headers: { ...headers, cookie },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; result: T };
    if (!json.ok) throw new Error(`rpc ${JSON.stringify(body)} failed: ${JSON.stringify(json)}`);
    return json.result;
  };
  return { rpc, events };
}

async function waitFor<T>(read: () => Promise<T | undefined>, ms = 20_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > end) throw new Error("condition not reached in time");
    await Bun.sleep(50);
  }
}

async function start(transcriptRoot: (home: string) => string): Promise<Client> {
  const home = mkdtempSync(join(tmpdir(), "kibo-moments-int-"));
  mkdirSync(join(home, "fake", "projects"), { recursive: true });
  const d = await startDaemon({
    home,
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    claudeBin: FAKE_CLAUDE,
    sampler: () => ({ cpu: 5, ram: 5 }),
    transcriptRoot: transcriptRoot(home),
    agentEnv: {
      ...process.env,
      KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("done"),
      KIBO_FAKE_CLAUDE_STATE: join(home, "fake", "projects"),
    },
  });
  cleanups.push(async () => {
    await d.stop();
    rmSync(home, { recursive: true, force: true });
  });
  return client(d);
}

async function runToEnd({ rpc }: Client): Promise<RunView> {
  const project = await rpc<ProjectMeta>({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#F97316",
  });
  const ticket = await rpc<Ticket>({
    method: "command",
    projectId: project.id,
    command: { method: "createTicket", title: "Fil", statusId: "todo" },
  });
  const profile = await rpc<AgentProfile>({
    method: "config",
    command: {
      method: "createProfile",
      profile: {
        name: "opus-dev",
        model: "opus",
        execution: "cli",
        permissionMode: "acceptEdits",
        workspace: "isolated",
        subagents: [],
        maxParallel: 1,
      },
    },
  });
  const run = await rpc<RunView>({
    method: "assignAgent",
    projectId: project.id,
    ticketId: ticket.id,
    profileId: profile.id,
    brief: "",
  });
  return waitFor(async () => {
    const found = (await rpc<AgentsState>({ method: "getAgents" })).runs.find((r) => r.id === run.id);
    return found?.state === "done" ? found : undefined;
  });
}

const momentsOf = (rpc: Client["rpc"], runId: string) => rpc<RunMomentsPage>({ method: "runMoments", runId });

test("the daemon serves the narrative of a fake claude run and broadcasts it", async () => {
  const c = await start((home) => join(home, "fake"));
  const run = await runToEnd(c);
  const page = await waitFor(async () => {
    const p = await momentsOf(c.rpc, run.id);
    return p.moments.some((m) => m.data.kind === "message") ? p : undefined;
  });
  expect(page.source).toBe("transcript");
  expect(page.moments.map((m) => m.data)).toEqual([
    expect.objectContaining({ kind: "actions", summary: "A lu 1 fichier" }),
    { kind: "message", text: "Travail terminé." },
  ]);
  const broadcast = c.events.flatMap((e) =>
    typeof e === "object" && e !== null && Reflect.get(e, "type") === "run.moments"
      ? (Reflect.get(e, "moments") as RunMoment[])
      : [],
  );
  expect(broadcast.map((m) => m.seq)).toEqual(page.moments.map((m) => m.seq));
  expect((await momentsOf(c.rpc, run.id)).moments).toEqual(page.moments);
  const peek = await c.rpc<RunPeek>({ method: "runPeek", runId: run.id });
  expect(peek).toMatchObject({
    runId: run.id,
    state: "done",
    lastMessage: "Travail terminé.",
    waiting: false,
  });
}, 40_000);

test("a transcript outside the accepted root falls back on the hooks", async () => {
  const c = await start((home) => join(home, "ailleurs"));
  const run = await runToEnd(c);
  const page = await waitFor(async () => {
    const p = await momentsOf(c.rpc, run.id);
    return p.moments.some((m) => m.data.kind === "message") ? p : undefined;
  });
  expect(page).toMatchObject({ source: "hooks", partial: "path-rejected" });
  expect(page.moments.map((m) => m.data.kind)).toEqual(["raw", "actions", "message"]);
  await expect(c.rpc({ method: "runMoments", runId: "inconnu" })).rejects.toThrow("NOT_FOUND");
}, 40_000);
