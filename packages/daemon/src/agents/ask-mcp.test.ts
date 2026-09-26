import { expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { ASK_REPLY, handleMcpLine, serveMcp } from "./ask-mcp";

const call = (method: string, params?: unknown) =>
  handleMcpLine(JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }));

test("answers the MCP handshake and lists the ask tool", () => {
  expect(call("initialize", { protocolVersion: "2025-06-18" })).toEqual({
    jsonrpc: "2.0",
    id: 1,
    result: {
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "kibo", version: "0.2.0" },
    },
  });
  const list = call("tools/list") as {
    result: { tools: Array<{ name: string; inputSchema: { required: string[] } }> };
  };
  expect(list.result.tools.map((t) => [t.name, t.inputSchema.required])).toEqual([
    ["ask_user", ["question"]],
  ]);
});

test("calling ask_user tells the agent to end its turn", () => {
  expect(call("tools/call", { name: "ask_user", arguments: { question: "?" } })).toEqual({
    jsonrpc: "2.0",
    id: 1,
    result: { content: [{ type: "text", text: ASK_REPLY }] },
  });
  expect(call("tools/call", { name: "rm_rf" })).toMatchObject({ error: { code: -32602 } });
});

test("notifications get no reply, unknown methods and bad JSON get errors", () => {
  expect(handleMcpLine(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }))).toBeNull();
  expect(call("resources/list")).toMatchObject({ error: { code: -32601 } });
  expect(handleMcpLine("{nope")).toMatchObject({ id: null, error: { code: -32700 } });
  expect(handleMcpLine(JSON.stringify({ id: 1, method: "ping" }))).toMatchObject({
    id: null,
    error: { code: -32600 },
  });
});

test("serves line-delimited JSON-RPC over streams", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const done = serveMcp(input, output);
  input.end(`\n${JSON.stringify({ jsonrpc: "2.0", id: 7, method: "ping" })}\n`);
  await done;
  expect(JSON.parse(String(output.read()))).toEqual({ jsonrpc: "2.0", id: 7, result: {} });
});
