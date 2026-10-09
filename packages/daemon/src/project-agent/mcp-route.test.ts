import { expect, test } from "bun:test";
import { type AgentMcpRequest, KiboError, TOOL_INPUTS } from "@kibo/schema";
import { AGENT_MCP_PATH, handleAgentMcp, MAX_AGENT_MCP_BYTES } from "./mcp-route";
import type { AgentMcpSink } from "./types";

const PROJECT_RUN = "11111111-1111-4111-8111-111111111111";
const TICKET_RUN = "22222222-2222-4222-8222-222222222222";
const DONE_RUN = "33333333-3333-4333-8333-333333333333";
const GOOD = "a".repeat(64);
const TICKET_TOKEN = "b".repeat(64);

function sink(
  call: AgentMcpSink["call"] = async (_runId, req) => `${req.tool}:${JSON.stringify(req.input)}`,
) {
  const calls: string[] = [];
  const s: AgentMcpSink = {
    verify(runId, token) {
      if (runId === TICKET_RUN && token === TICKET_TOKEN)
        throw new KiboError("FORBIDDEN", "not a project run");
      return runId === PROJECT_RUN && token === GOOD;
    },
    call: (runId, req) => {
      calls.push(runId);
      return call(runId, req);
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

test("the path takes a run id", () => {
  expect(AGENT_MCP_PATH.exec(`/agent-mcp/${PROJECT_RUN}`)?.[1]).toBe(PROJECT_RUN);
  expect(AGENT_MCP_PATH.exec("/agent-mcp/not-a-run")).toBeNull();
});

test("a project run with its live token reaches the tools and gets the text back", async () => {
  const { s, calls } = sink();
  const res = await handleAgentMcp(post(PROJECT_RUN, bearer(GOOD), LIST), PROJECT_RUN, s);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, text: 'list_tickets:{"status":"done"}' });
  expect(calls).toEqual([PROJECT_RUN]);
});

test("no bearer, another run's bearer, or a finished turn is unauthorized; a ticket run is forbidden", async () => {
  const { s, calls } = sink();
  expect((await handleAgentMcp(post(PROJECT_RUN, {}, LIST), PROJECT_RUN, s)).status).toBe(401);
  expect((await handleAgentMcp(post(PROJECT_RUN, bearer(TICKET_TOKEN), LIST), PROJECT_RUN, s)).status).toBe(
    401,
  );
  expect((await handleAgentMcp(post(DONE_RUN, bearer(GOOD), LIST), DONE_RUN, s)).status).toBe(401);
  const ticket = await handleAgentMcp(post(TICKET_RUN, bearer(TICKET_TOKEN), LIST), TICKET_RUN, s);
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
