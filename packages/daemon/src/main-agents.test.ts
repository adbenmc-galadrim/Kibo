import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, AgentsState, ProjectMeta, RunLogEntry, RunView, Ticket } from "@kibo/schema";
import { FAKE_CLAUDE, scenarioPath } from "./agents/fake-claude-scenario";

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function readyLine(stdout: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stdout.getReader();
  let out = "";
  while (!out.includes("\n")) {
    const { value, done } = await reader.read();
    if (done) break;
    out += new TextDecoder().decode(value);
  }
  reader.releaseLock();
  return out;
}

async function rpcClient(out: string) {
  const [, origin = "", token = ""] = /^KIBO_READY (\S+)\/#pair=(\w+)\n/.exec(out) ?? [];
  const headers = { "content-type": "application/json", origin };
  const paired = await fetch(`${origin}/api/pair`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token }),
  });
  const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
  return async <T>(body: unknown): Promise<T> => {
    const res = await fetch(`${origin}/api/rpc`, {
      method: "POST",
      headers: { ...headers, cookie },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; result: T };
    if (!json.ok) throw new Error(`rpc ${JSON.stringify(body)} failed: ${JSON.stringify(json)}`);
    return json.result;
  };
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

test("stopping the daemon process kills the agent runs in progress", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-main-agents-"));
  mkdirSync(join(home, "fake"));
  const args = ["--port", "0", "--sandbox-port", "0", "--claude-bin", FAKE_CLAUDE, "--host-load", "5,5"];
  const proc = Bun.spawn(["bun", join(import.meta.dir, "main.ts"), ...args], {
    env: {
      ...process.env,
      KIBO_HOME: home,
      KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("hold"),
      KIBO_FAKE_CLAUDE_STATE: join(home, "fake"),
    },
    stdout: "pipe",
    stderr: "inherit",
  });
  let pid = 0;
  try {
    const rpc = await rpcClient(await readyLine(proc.stdout));
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
      command: { method: "createTicket", title: "Hooks", statusId: "in_progress" },
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
    await waitFor(async () => {
      const state = await rpc<AgentsState>({ method: "getAgents" });
      return state.runs.find((r) => r.id === run.id && r.lastActivity?.event === "PreToolUse");
    });
    pid = await waitFor(async () => {
      const log = await rpc<RunLogEntry[]>({ method: "getRunLog", runId: run.id });
      return log.flatMap((e) => (e.event.type === "spawned" ? [e.event.pid] : [])).at(-1);
    });
    expect(alive(pid)).toBe(true);
    proc.kill("SIGTERM");
    expect(await proc.exited).toBe(0);
    const deadline = Date.now() + 2000;
    while (alive(pid) && Date.now() < deadline) await Bun.sleep(25);
    expect(alive(pid)).toBe(false);
  } finally {
    proc.kill("SIGKILL");
    if (pid > 0 && alive(pid)) process.kill(-pid, "SIGKILL");
    rmSync(home, { recursive: true, force: true });
  }
}, 40_000);
