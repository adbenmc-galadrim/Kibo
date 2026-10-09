import { expect, test } from "bun:test";
import { join } from "node:path";
import { FAIL_CLOSED_DENY, forwardHook, type PostFn } from "./kibo-hook";

const TOKEN = "f".repeat(64);
const ENV = { KIBO_HOOK_URL: "http://127.0.0.1:9/hooks/r1", KIBO_RUN_TOKEN: TOKEN };
const input = JSON.stringify({
  session_id: "s1",
  hook_event_name: "PreToolUse",
  tool_name: "Read",
  tool_input: { file_path: "a.ts" },
});
const stop = JSON.stringify({ session_id: "s1", hook_event_name: "Stop" });
const down: PostFn = async () => {
  throw new Error("ECONNREFUSED");
};

function run(mode: string, stdin: string, env?: Record<string, string>) {
  const proc = Bun.spawn(["bun", join(import.meta.dir, "kibo-hook.ts"), mode], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    ...(env ? { env } : {}),
  });
  proc.stdin.write(stdin);
  proc.stdin.end();
  return proc;
}

function capture() {
  const printed: string[] = [];
  const logs: string[] = [];
  return { printed, logs, out: (t: string) => printed.push(t), log: (l: string) => logs.push(l) };
}

test("posts the reduced payload with the run token", async () => {
  const seen: Array<{ url: string; init: RequestInit }> = [];
  const fake: PostFn = async (url, init) => {
    seen.push({ url, init });
    return new Response(null, { status: 204 });
  };
  const c = capture();
  expect(await forwardHook({ stdin: input, env: ENV, fetch: fake, out: c.out, log: c.log })).toBe(0);
  expect(seen[0]?.url).toBe(ENV.KIBO_HOOK_URL);
  expect(seen[0]?.init.method).toBe("POST");
  expect(new Headers(seen[0]?.init.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
  expect(JSON.parse(String(seen[0]?.init.body))).toMatchObject({
    payload: { event: "PreToolUse", tool: "Read", detail: "a.ts" },
    toolInput: { file_path: "a.ts" },
  });
  expect(c.printed).toEqual([]);
  expect(c.logs).toEqual([]);
});

test("a PreToolUse decision from the daemon is printed for Claude Code", async () => {
  const decision = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "non",
    },
  };
  const fake: PostFn = async () => Response.json(decision);
  const c = capture();
  expect(await forwardHook({ stdin: input, env: ENV, fetch: fake, out: c.out })).toBe(0);
  expect(JSON.parse(c.printed.join(""))).toEqual(decision);
});

test("every PreToolUse the daemon could not check is refused", async () => {
  const refused: PostFn = async () => new Response("unauthorized", { status: 401 });
  const cases: Array<Omit<Parameters<typeof forwardHook>[0], "out" | "log">> = [
    { stdin: input, env: ENV, fetch: down },
    { stdin: input, env: ENV, fetch: refused },
    { stdin: input, env: {}, fetch: down },
    { stdin: input, env: { KIBO_HOOK_URL: ENV.KIBO_HOOK_URL }, fetch: down },
    { stdin: JSON.stringify({ hook_event_name: "PreToolUse" }), env: ENV, fetch: down },
    { stdin: "{", env: ENV, fetch: down },
  ];
  for (const one of cases) {
    const c = capture();
    expect(await forwardHook({ ...one, out: c.out, log: c.log })).toBe(0);
    expect(c.printed).toEqual([FAIL_CLOSED_DENY]);
    expect(c.logs).toHaveLength(1);
  }
  expect(JSON.parse(FAIL_CLOSED_DENY)).toMatchObject({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny" },
  });
});

test("other events are never refused and never block the agent", async () => {
  const refused: PostFn = async () => new Response("unauthorized", { status: 401 });
  for (const one of [
    { stdin: stop, env: ENV, fetch: down },
    { stdin: stop, env: ENV, fetch: refused },
    { stdin: stop, env: {}, fetch: down },
    {
      stdin: JSON.stringify({ session_id: "s1", hook_event_name: "UserPromptSubmit" }),
      env: ENV,
      fetch: down,
    },
  ]) {
    const c = capture();
    expect(await forwardHook({ ...one, out: c.out, log: c.log })).toBe(1);
    expect(c.printed).toEqual([]);
    expect(c.logs).toHaveLength(1);
  }
});

test("never prints the token", async () => {
  const c = capture();
  const echo: PostFn = async (_url, init) => new Response(`bad ${String(init.headers)}`, { status: 500 });
  await forwardHook({ stdin: input, env: ENV, fetch: echo, out: c.out, log: c.log });
  await forwardHook({ stdin: stop, env: ENV, fetch: down, out: c.out, log: c.log });
  await forwardHook({ stdin: "{", env: ENV, fetch: down, out: c.out, log: c.log });
  expect(c.logs).toHaveLength(3);
  expect([...c.logs, ...c.printed].join("\n")).not.toContain(TOKEN);
});

test("the executable serves MCP on stdio", async () => {
  const proc = run("mcp", `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" })}\n`);
  expect(JSON.parse((await new Response(proc.stdout).text()).trim())).toEqual({
    jsonrpc: "2.0",
    id: 1,
    result: {},
  });
  expect(await proc.exited).toBe(0);
});

test("the executable refuses a PreToolUse when the daemon is down, and never exits 2", async () => {
  const proc = run("event", input, {
    PATH: process.env.PATH ?? "",
    KIBO_HOOK_URL: "http://127.0.0.1:1/hooks/r1",
    KIBO_RUN_TOKEN: TOKEN,
  });
  expect(await new Response(proc.stdout).text()).toBe(FAIL_CLOSED_DENY);
  expect(await new Response(proc.stderr).text()).not.toContain(TOKEN);
  expect(await proc.exited).toBe(0);
});

test("the executable rejects an unknown mode", async () => {
  const proc = run("nope", "");
  expect(await new Response(proc.stderr).text()).toContain("usage");
  expect(await proc.exited).toBe(64);
});

test("the executable posts to a real daemon and prints its decision", async () => {
  const seen: Array<{ auth: string | null; body: unknown }> = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      seen.push({ auth: req.headers.get("authorization"), body: await req.json() });
      return Response.json({
        hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" },
      });
    },
  });
  try {
    const proc = run("event", input, {
      PATH: process.env.PATH ?? "",
      KIBO_HOOK_URL: `http://127.0.0.1:${server.port}/hooks/r1`,
      KIBO_RUN_TOKEN: TOKEN,
    });
    const printed = await new Response(proc.stdout).text();
    expect(await proc.exited).toBe(0);
    expect(JSON.parse(printed)).toMatchObject({ hookSpecificOutput: { permissionDecision: "allow" } });
    expect(seen).toEqual([
      { auth: `Bearer ${TOKEN}`, body: expect.objectContaining({ toolInput: { file_path: "a.ts" } }) },
    ]);
  } finally {
    server.stop(true);
  }
});

test("the MCP executable reads its environment and asks the daemon for project tools", async () => {
  const seen: Array<{ path: string; auth: string | null; body: unknown }> = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      seen.push({
        path: new URL(req.url).pathname,
        auth: req.headers.get("authorization"),
        body: await req.json(),
      });
      return Response.json({ ok: true, text: '{"items":[],"nextCursor":null,"total":0}' });
    },
  });
  try {
    const lines = [
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "list_tickets", arguments: { status: "done" } },
      },
    ];
    const proc = run("mcp", lines.map((l) => `${JSON.stringify(l)}\n`).join(""), {
      PATH: process.env.PATH ?? "",
      KIBO_MCP_URL: `http://127.0.0.1:${server.port}/agent-mcp/r1`,
      KIBO_RUN_TOKEN: TOKEN,
    });
    const out = await new Response(proc.stdout).text();
    expect(await proc.exited).toBe(0);
    const replies = new Map(
      out
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l) as { id: number; result: { tools?: unknown[]; content?: unknown } })
        .map((r) => [r.id, r.result]),
    );
    expect(replies.get(1)?.tools).toHaveLength(12);
    expect(replies.get(2)?.content).toEqual([
      { type: "text", text: '{"items":[],"nextCursor":null,"total":0}' },
    ]);
    expect(seen).toEqual([
      {
        path: "/agent-mcp/r1",
        auth: `Bearer ${TOKEN}`,
        body: { tool: "list_tickets", input: { status: "done" } },
      },
    ]);
  } finally {
    server.stop(true);
  }
});
