import { expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { PROJECT_AGENT_TOOLS, TOOL_SPECS } from "@kibo/schema";
import { ASK_QUESTION_REPLY, ASK_REPLY, handleMcpLine, type McpTools, serveMcp } from "./ask-mcp";

type Called = { tool: string; input: unknown };

const daemon = (reply = { text: "{}", isError: false }) => {
  const calls: Called[] = [];
  const fn = async (tool: string, input: unknown) => {
    calls.push({ tool, input });
    return reply;
  };
  return { calls, fn };
};

const TICKET_RUN: McpTools = { project: false };
const PROJECT_RUN: McpTools = { project: true };

const call = (method: string, params?: unknown, tools = TICKET_RUN, daemonCall = daemon().fn) =>
  handleMcpLine(JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), tools, daemonCall);

test("answers the MCP handshake and lists the ask tool", async () => {
  expect(await call("initialize", { protocolVersion: "2025-06-18" })).toEqual({
    jsonrpc: "2.0",
    id: 1,
    result: {
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "kibo", version: "0.2.0" },
    },
  });
  const list = (await call("tools/list")) as {
    result: { tools: Array<{ name: string; inputSchema: { required: string[] } }> };
  };
  expect(list.result.tools.map((t) => [t.name, t.inputSchema.required])).toEqual([
    ["ask_user", ["question"]],
    ["ask_question", ["question", "provisional"]],
  ]);
});

test("both ask tools declare the question, its context, up to six options and a provisional choice", async () => {
  const list = (await call("tools/list")) as {
    result: { tools: Array<{ inputSchema: { properties: Record<string, Record<string, unknown>> } }> };
  };
  for (const tool of list.result.tools) {
    const { question, context, options, provisional } = tool.inputSchema.properties;
    expect(question).toMatchObject({ type: "string" });
    expect(context).toMatchObject({ type: "string" });
    expect(options).toMatchObject({ type: "array", items: { type: "string" }, maxItems: 6 });
    expect(provisional).toMatchObject({ type: "string" });
  }
});

test("calling ask_question tells the agent to go on with its provisional choice", async () => {
  expect(
    await call("tools/call", { name: "ask_question", arguments: { question: "?", provisional: "Non" } }),
  ).toEqual({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: ASK_QUESTION_REPLY }] } });
  expect(ASK_QUESTION_REPLY).toBe(
    "Question enregistrée dans Kibo, ouverte. Continue avec ton choix provisoire ; la réponse te sera transmise.",
  );
});

test("calling ask_user tells the agent to end its turn", async () => {
  expect(await call("tools/call", { name: "ask_user", arguments: { question: "?" } })).toEqual({
    jsonrpc: "2.0",
    id: 1,
    result: { content: [{ type: "text", text: ASK_REPLY }] },
  });
  expect(await call("tools/call", { name: "rm_rf" })).toMatchObject({ error: { code: -32602 } });
});

test("notifications get no reply, unknown methods and bad JSON get errors", async () => {
  const line = (text: string) => handleMcpLine(text, TICKET_RUN, daemon().fn);
  expect(await line(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }))).toBeNull();
  expect(await call("resources/list")).toMatchObject({ error: { code: -32601 } });
  expect(await line("{nope")).toMatchObject({ id: null, error: { code: -32700 } });
  expect(await line(JSON.stringify({ id: 1, method: "ping" }))).toMatchObject({
    id: null,
    error: { code: -32600 },
  });
});

test("serves line-delimited JSON-RPC over streams", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const done = serveMcp(input, output, {});
  input.end(`\n${JSON.stringify({ jsonrpc: "2.0", id: 7, method: "ping" })}\n`);
  await done;
  expect(JSON.parse(String(output.read()))).toEqual({ jsonrpc: "2.0", id: 7, result: {} });
});

const toolNames = async (tools: McpTools) => {
  const list = (await call("tools/list", undefined, tools)) as { result: { tools: Array<{ name: string }> } };
  return list.result.tools.map((t) => t.name);
};

test("a ticket run lists only the two question tools and cannot call project tools", async () => {
  expect(await toolNames(TICKET_RUN)).toEqual(["ask_user", "ask_question"]);
  const d = daemon();
  expect(await call("tools/call", { name: "list_tickets", arguments: {} }, TICKET_RUN, d.fn)).toMatchObject({
    error: { code: -32602 },
  });
  expect(d.calls).toEqual([]);
});

test("a project run lists the question tools and the ten project tools with their schemas", async () => {
  const names = await toolNames(PROJECT_RUN);
  expect(names).toHaveLength(12);
  expect(names).toEqual(["ask_user", "ask_question", ...PROJECT_AGENT_TOOLS]);
  const list = (await call("tools/list", undefined, PROJECT_RUN)) as {
    result: { tools: Array<{ name: string; description: string; inputSchema: unknown }> };
  };
  expect(list.result.tools.slice(2)).toEqual(
    TOOL_SPECS.map((s) => ({ name: s.name, description: s.description, inputSchema: s.inputSchema })),
  );
});

test("calling a project tool asks the daemon and relays its text or its error", async () => {
  const ok = daemon({ text: '{"items":[]}', isError: false });
  expect(
    await call("tools/call", { name: "list_tickets", arguments: { status: "done" } }, PROJECT_RUN, ok.fn),
  ).toEqual({
    jsonrpc: "2.0",
    id: 1,
    result: { content: [{ type: "text", text: '{"items":[]}' }], isError: false },
  });
  expect(ok.calls).toEqual([{ tool: "list_tickets", input: { status: "done" } }]);
  const ko = daemon({ text: "Kibo injoignable : TypeError.", isError: true });
  expect(await call("tools/call", { name: "project_overview" }, PROJECT_RUN, ko.fn)).toEqual({
    jsonrpc: "2.0",
    id: 1,
    result: { content: [{ type: "text", text: "Kibo injoignable : TypeError." }], isError: true },
  });
  expect(ko.calls).toEqual([{ tool: "project_overview", input: {} }]);
});

test("in a project run the question tools keep their fixed answer and unknown tools are refused", async () => {
  const d = daemon();
  expect(
    await call("tools/call", { name: "ask_user", arguments: { question: "?" } }, PROJECT_RUN, d.fn),
  ).toEqual({
    jsonrpc: "2.0",
    id: 1,
    result: { content: [{ type: "text", text: ASK_REPLY }] },
  });
  expect(await call("tools/call", { name: "rm_rf" }, PROJECT_RUN, d.fn)).toMatchObject({
    error: { code: -32602 },
  });
  expect(d.calls).toEqual([]);
});

const serve = async (env: Record<string, string | undefined>, lines: unknown[]) => {
  const input = new PassThrough();
  const output = new PassThrough();
  const chunks: string[] = [];
  output.on("data", (chunk) => chunks.push(String(chunk)));
  const done = serveMcp(input, output, env);
  input.end(lines.map((l) => `${JSON.stringify(l)}\n`).join(""));
  await done;
  return chunks
    .join("")
    .trim()
    .split("\n")
    .map(
      (l) =>
        JSON.parse(l) as { id: number; result: { tools?: unknown[]; isError?: boolean; content?: unknown } },
    );
};

test("the served tools depend on KIBO_MCP_URL and a down daemon never kills the server", async () => {
  const list = { jsonrpc: "2.0", id: 1, method: "tools/list" };
  expect((await serve({}, [list]))[0]?.result.tools).toHaveLength(2);
  const env = { KIBO_MCP_URL: "http://127.0.0.1:1/agent-mcp/r1", KIBO_RUN_TOKEN: "t" };
  const replies = await serve(env, [
    list,
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_runs", arguments: {} } },
    { jsonrpc: "2.0", id: 3, method: "ping" },
  ]);
  const byId = new Map(replies.map((r) => [r.id, r]));
  expect(byId.get(1)?.result.tools).toHaveLength(12);
  expect(byId.get(2)?.result.isError).toBe(true);
  expect(byId.get(3)?.result).toEqual({});
});
