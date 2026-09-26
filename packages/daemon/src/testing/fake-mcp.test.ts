import { afterAll, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { FAKE_MCP_STDIO, startFakeMcpHttp } from "./fake-mcp";

const http = await startFakeMcpHttp({ bearer: "mcp-bearer-123456" });
afterAll(() => http.stop());

test("stdio: tools are listed and callable", async () => {
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [FAKE_MCP_STDIO] }));
  const tools = (await client.listTools()).tools.map((t) => t.name);
  expect(tools).toEqual(
    expect.arrayContaining([
      "echo",
      "list_items",
      "get_metadata",
      "get_screenshot",
      "slow",
      "fail",
      "big",
      "env",
    ]),
  );
  const out = await client.callTool({ name: "echo", arguments: { text: "salut" } });
  expect(out.content).toEqual([{ type: "text", text: "salut" }]);
  await client.close();
});

test("http: bearer required, resources readable", async () => {
  const anonymous = new Client({ name: "test", version: "1.0.0" });
  await expect(anonymous.connect(new StreamableHTTPClientTransport(new URL(http.url)))).rejects.toThrow();
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(http.url), {
      requestInit: { headers: { authorization: "Bearer mcp-bearer-123456" } },
    }),
  );
  const res = await client.readResource({ uri: "fake://items" });
  expect(JSON.stringify(res.contents)).toContain("Premier");
  await client.close();
});
