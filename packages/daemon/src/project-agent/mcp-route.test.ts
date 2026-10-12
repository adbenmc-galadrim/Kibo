import { expect, test } from "bun:test";
import { type AgentMcpRequest, KiboError, type RunView, TOOL_INPUTS } from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { AGENT_MCP_PATH, handleAgentMcp, MAX_AGENT_MCP_BYTES } from "./mcp-route";
import type { AgentMcpSink } from "./types";

const PROJECT_RUN = "11111111-1111-4111-8111-111111111111";
const TICKET_RUN = "22222222-2222-4222-8222-222222222222";
const DONE_RUN = "33333333-3333-4333-8333-333333333333";
const GOOD = "a".repeat(64);
const TICKET_TOKEN = "b".repeat(64);

const PROJECT = runView({ id: PROJECT_RUN, kind: "project", ticketId: null, state: "running" });
const TICKET = runView({ id: TICKET_RUN, kind: "ticket", state: "running" });
const RUNS = new Map([PROJECT, TICKET].map((r) => [r.id, r]));

function sink(
  call: AgentMcpSink["call"] = async (_run, tool, input) => `${tool}:${JSON.stringify(input)}`,
  runOf: AgentMcpSink["run"] = (runId) => RUNS.get(runId) ?? null,
) {
  const calls: RunView[] = [];
  const s: AgentMcpSink = {
    verify: (runId, token) =>
      (runId === PROJECT_RUN && token === GOOD) || (runId === TICKET_RUN && token === TICKET_TOKEN),
    run: runOf,
    call: (run, tool, input) => {
      calls.push(run);
      return call(run, tool, input);
    },
  };
  return { s, calls };
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
const post = (runId: string, headers: Record<string, string>, body: unknown, method = "POST") =>
  new Request(`http://127.0.0.1:1/agent-mcp/${runId}`, {
    method,
    headers,
    ...(method === "GET" ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
const LIST: AgentMcpRequest = { tool: "list_tickets", input: { status: "done" } };
const PROGRESS: AgentMcpRequest = { tool: "ticket_progress", input: { plan: [] } };
const SIGNAL: AgentMcpRequest = { tool: "signal_project", input: { kind: "ticket", title: "Tests" } };
const PEEK: AgentMcpRequest = { tool: "peek_work", input: { run: "BOU-12" } };
const LIST_SIGNALS: AgentMcpRequest = { tool: "list_signals", input: {} };
const REVIEW: AgentMcpRequest = {
  tool: "skill_review",
  input: { reviews: [{ skill: "brainstorming", verdict: "ok", note: "Bien." }] },
};

test("the path takes a run id", () => {
  expect(AGENT_MCP_PATH.exec(`/agent-mcp/${PROJECT_RUN}`)?.[1]).toBe(PROJECT_RUN);
  expect(AGENT_MCP_PATH.exec("/agent-mcp/not-a-run")).toBeNull();
});

test("a project run with its live token reaches the tools and gets the text back", async () => {
  const { s, calls } = sink();
  const res = await handleAgentMcp(post(PROJECT_RUN, bearer(GOOD), LIST), PROJECT_RUN, s);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, text: 'list_tickets:{"status":"done"}' });
  expect(calls).toEqual([PROJECT]);
});

test("a ticket run reaches ticket_progress with its own run, never the project tools", async () => {
  const { s, calls } = sink();
  const res = await handleAgentMcp(post(TICKET_RUN, bearer(TICKET_TOKEN), PROGRESS), TICKET_RUN, s);
  expect(await res.json()).toEqual({ ok: true, text: 'ticket_progress:{"plan":[]}' });
  expect(calls).toEqual([TICKET]);
  const project = await handleAgentMcp(post(TICKET_RUN, bearer(TICKET_TOKEN), LIST), TICKET_RUN, s);
  expect(project.status).toBe(403);
  expect(await project.json()).toEqual({
    ok: false,
    error: { code: "FORBIDDEN", message: "list_tickets is not a ticket run tool" },
  });
  expect(calls).toHaveLength(1);
});

test("a project run cannot write a ticket's progress", async () => {
  const { s, calls } = sink();
  const res = await handleAgentMcp(post(PROJECT_RUN, bearer(GOOD), PROGRESS), PROJECT_RUN, s);
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({
    ok: false,
    error: { code: "FORBIDDEN", message: "ticket_progress is not a project run tool" },
  });
  expect(calls).toEqual([]);
});

test("a ticket run signals the project agent but never lists the signals", async () => {
  const { s, calls } = sink();
  const res = await handleAgentMcp(post(TICKET_RUN, bearer(TICKET_TOKEN), SIGNAL), TICKET_RUN, s);
  expect(await res.json()).toEqual({ ok: true, text: 'signal_project:{"kind":"ticket","title":"Tests"}' });
  expect(calls).toEqual([TICKET]);
  const list = await handleAgentMcp(post(TICKET_RUN, bearer(TICKET_TOKEN), LIST_SIGNALS), TICKET_RUN, s);
  expect(list.status).toBe(403);
  expect(calls).toHaveLength(1);
});

test("a project run cannot signal itself", async () => {
  const { s, calls } = sink();
  const res = await handleAgentMcp(post(PROJECT_RUN, bearer(GOOD), SIGNAL), PROJECT_RUN, s);
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({
    ok: false,
    error: { code: "FORBIDDEN", message: "signal_project is not a project run tool" },
  });
  expect(calls).toEqual([]);
});

test("skill_review is shared: a ticket run and a project run both reach it", async () => {
  const { s, calls } = sink(async (_run, tool) => `${tool}:ok`);
  for (const [runId, token] of [
    [TICKET_RUN, TICKET_TOKEN],
    [PROJECT_RUN, GOOD],
  ] as const) {
    const res = await handleAgentMcp(post(runId, bearer(token), REVIEW), runId, s);
    expect(await res.json()).toEqual({ ok: true, text: "skill_review:ok" });
  }
  expect(calls).toEqual([TICKET, PROJECT]);
});

test("a verified run that the agents no longer know is not found", async () => {
  const { s, calls } = sink(undefined, () => null);
  expect((await handleAgentMcp(post(PROJECT_RUN, bearer(GOOD), LIST), PROJECT_RUN, s)).status).toBe(404);
  expect(calls).toEqual([]);
});

test("no bearer, another run's bearer or a finished turn is unauthorized; a refusing sink is forbidden", async () => {
  const { s, calls } = sink();
  expect((await handleAgentMcp(post(PROJECT_RUN, {}, LIST), PROJECT_RUN, s)).status).toBe(401);
  expect((await handleAgentMcp(post(PROJECT_RUN, bearer(TICKET_TOKEN), LIST), PROJECT_RUN, s)).status).toBe(
    401,
  );
  expect((await handleAgentMcp(post(TICKET_RUN, bearer(GOOD), PROGRESS), TICKET_RUN, s)).status).toBe(401);
  expect((await handleAgentMcp(post(DONE_RUN, bearer(GOOD), LIST), DONE_RUN, s)).status).toBe(401);
  const refusing: AgentMcpSink = {
    ...s,
    verify: () => {
      throw new KiboError("FORBIDDEN", "not a project run");
    },
  };
  const ticket = await handleAgentMcp(post(TICKET_RUN, bearer(TICKET_TOKEN), LIST), TICKET_RUN, refusing);
  expect(ticket.status).toBe(403);
  expect(await ticket.json()).toMatchObject({
    ok: false,
    error: { code: "FORBIDDEN", message: "not a project run" },
  });
  expect(calls).toEqual([]);
});

test("GET is not allowed, a large body is refused and a bad body is invalid", async () => {
  const { s, calls } = sink();
  expect((await handleAgentMcp(post(PROJECT_RUN, bearer(GOOD), null, "GET"), PROJECT_RUN, s)).status).toBe(
    405,
  );
  const big = { tool: "list_tickets", input: { query: "x".repeat(MAX_AGENT_MCP_BYTES) } };
  expect((await handleAgentMcp(post(PROJECT_RUN, bearer(GOOD), big), PROJECT_RUN, s)).status).toBe(413);
  expect((await handleAgentMcp(post(PROJECT_RUN, bearer(GOOD), "{"), PROJECT_RUN, s)).status).toBe(400);
  expect(
    (await handleAgentMcp(post(PROJECT_RUN, bearer(GOOD), { tool: "delete_project" }), PROJECT_RUN, s))
      .status,
  ).toBe(400);
  expect(calls).toEqual([]);
});

test("a KiboError of a tool is a readable failure; anything else is INTERNAL", async () => {
  const notFound = sink(async () => {
    throw new KiboError("NOT_FOUND", "ticket AUTRE-1 not found");
  });
  const res = await handleAgentMcp(
    post(PROJECT_RUN, bearer(GOOD), { tool: "get_ticket", input: { key: "AUTRE-1" } }),
    PROJECT_RUN,
    notFound.s,
  );
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    ok: false,
    error: { code: "NOT_FOUND", message: "ticket AUTRE-1 not found" },
  });
  const crash = sink(async () => {
    throw new Error("boom");
  });
  const broken = await handleAgentMcp(post(PROJECT_RUN, bearer(GOOD), LIST), PROJECT_RUN, crash.s);
  expect(broken.status).toBe(200);
  expect(await broken.json()).toEqual({ ok: false, error: { code: "INTERNAL", message: "internal error" } });
});

test("no tool input names a project: the project always comes from the run", () => {
  for (const schema of Object.values(TOOL_INPUTS)) {
    const parsed = schema.safeParse({ projectId: "other" });
    if (parsed.success) expect(parsed.data).not.toHaveProperty("projectId");
  }
});

test("peek_work is a ticket run tool, never a project run tool", async () => {
  const { s, calls } = sink();
  const res = await handleAgentMcp(post(TICKET_RUN, bearer(TICKET_TOKEN), PEEK), TICKET_RUN, s);
  expect(await res.json()).toEqual({ ok: true, text: 'peek_work:{"run":"BOU-12"}' });
  expect(calls).toEqual([TICKET]);
  const project = await handleAgentMcp(post(PROJECT_RUN, bearer(GOOD), PEEK), PROJECT_RUN, s);
  expect(project.status).toBe(403);
  expect(await project.json()).toEqual({
    ok: false,
    error: { code: "FORBIDDEN", message: "peek_work is not a project run tool" },
  });
  expect(calls).toEqual([TICKET]);
});
