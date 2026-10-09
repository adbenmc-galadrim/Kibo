import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanFakeDirs, tmp } from "./fake-claude.test-helper";
import { callMcpTool, mcpServerFrom } from "./fake-claude-mcp";

cleanFakeDirs();

const KIBO = {
  command: "bun",
  args: ["x.ts", "mcp"],
  env: { KIBO_MCP_URL: "http://u", KIBO_RUN_TOKEN: "t" },
};

test("reads the kibo server from an inline --mcp-config", () => {
  const config = JSON.stringify({ mcpServers: { kibo: KIBO } });
  expect(mcpServerFrom(["-p", "--mcp-config", config, "--verbose"])).toEqual(KIBO);
  const bare = JSON.stringify({ mcpServers: { kibo: { command: "bun", args: ["x.ts", "mcp"] } } });
  expect(mcpServerFrom(["--mcp-config", bare])).toEqual({ command: "bun", args: ["x.ts", "mcp"], env: {} });
});

test("reads the kibo server from a --mcp-config file", () => {
  const file = join(tmp(), "mcp.json");
  writeFileSync(file, JSON.stringify({ mcpServers: { other: { command: "x" }, kibo: KIBO } }));
  expect(mcpServerFrom(["--mcp-config", file])).toEqual(KIBO);
});

test("fails explicitly without a usable --mcp-config", () => {
  expect(() => mcpServerFrom(["-p"])).toThrow("no --mcp-config");
  expect(() => mcpServerFrom(["--mcp-config", JSON.stringify({ mcpServers: {} })])).toThrow(
    "no kibo server in --mcp-config",
  );
});

const SERVER = `
const log = process.env.LOG;
const fs = require("node:fs");
let buffer = "";
const answer = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\\n");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let i;
  while ((i = buffer.indexOf("\\n")) >= 0) {
    const line = buffer.slice(0, i);
    buffer = buffer.slice(i + 1);
    fs.appendFileSync(log, line + "\\n");
    const msg = JSON.parse(line);
    if (msg.method === "initialize") answer(msg.id, { protocolVersion: msg.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "t", version: "1" } });
    if (msg.method === "tools/call") answer(msg.id, { content: [{ type: "text", text: JSON.stringify({ name: msg.params.name, arguments: msg.params.arguments, url: process.env.KIBO_MCP_URL ?? null, token: process.env.KIBO_RUN_TOKEN ?? null, inherited: process.env.FAKE_PARENT_SECRET ?? null }) }], isError: msg.params.name === "fail" });
  }
});
process.stdin.on("end", () => fs.appendFileSync(log, "closed\\n"));
`;

const testServer = (env: Record<string, string>) => {
  const log = join(tmp(), "server.log");
  writeFileSync(log, "");
  return { log, server: { command: "bun", args: ["-e", SERVER], env: { LOG: log, ...env } } };
};

test("initializes the server, calls the tool, then closes it", async () => {
  const { log, server } = testServer({
    KIBO_MCP_URL: "http://127.0.0.1:1/agent-mcp/r1",
    KIBO_RUN_TOKEN: "tok",
  });
  process.env.FAKE_PARENT_SECRET = "leak";
  try {
    const reply = await callMcpTool(server, "list_tickets", { status: "done" });
    expect(reply.isError).toBe(false);
    expect(JSON.parse(reply.text)).toEqual({
      name: "list_tickets",
      arguments: { status: "done" },
      url: "http://127.0.0.1:1/agent-mcp/r1",
      token: "tok",
      inherited: null,
    });
  } finally {
    delete process.env.FAKE_PARENT_SECRET;
  }
  await Bun.sleep(50);
  const lines = readFileSync(log, "utf8").trim().split("\n");
  expect(lines.at(-1)).toBe("closed");
  const messages = lines.slice(0, -1).map((l) => JSON.parse(l) as { jsonrpc: string; method: string });
  expect(messages.map((m) => m.method)).toEqual(["initialize", "notifications/initialized", "tools/call"]);
  expect(messages.every((m) => m.jsonrpc === "2.0")).toBe(true);
});

test("a tool error is relayed as an error result", async () => {
  const { server } = testServer({});
  expect(await callMcpTool(server, "fail", {})).toMatchObject({ isError: true });
});

test("a server that dies or never answers is an error result, not a hang", async () => {
  const dead = { command: "bun", args: ["-e", "process.exit(3)"], env: {} };
  expect(await callMcpTool(dead, "list_runs", {})).toMatchObject({ isError: true });
  const mute = { command: "bun", args: ["-e", "setInterval(() => {}, 1000)"], env: {} };
  const reply = await callMcpTool(mute, "list_runs", {}, 200);
  expect(reply).toEqual({ text: "fake-claude: MCP server timed out", isError: true });
});
