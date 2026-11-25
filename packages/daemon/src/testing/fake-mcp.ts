import { createServer, type IncomingMessage, type Server } from "node:http";
import type { Socket } from "node:net";
import { join } from "node:path";
import { McpServer, type RegisteredTool, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod-v4";

export const FAKE_MCP_STDIO = join(import.meta.dir, "fake-mcp-stdio.ts");
export const FAKE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
export const FAKE_ITEMS = {
  items: [
    { id: "a1", name: "Premier", detail: "Élément un", link: "https://example.com/a1" },
    { id: "a2", name: "Second", detail: "Élément deux", link: "javascript:alert(1)" },
  ],
};

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

export function buildFakeMcpServer(opts: { omit?: string[] } = {}): McpServer {
  const s = new McpServer({ name: "fake-mcp", version: "1.0.0" });
  const omit = opts.omit ?? [];
  const tool = (name: string, register: (name: string) => RegisteredTool): void => {
    const registered = register(name);
    if (omit.includes(name)) registered.remove();
  };
  tool("echo", (n) =>
    s.registerTool(n, { description: "Echo", inputSchema: { text: z.string() } }, async ({ text: t }) =>
      text(t),
    ),
  );
  tool("list_items", (n) =>
    s.registerTool(n, { description: "Items" }, async () => text(JSON.stringify(FAKE_ITEMS))),
  );
  tool("get_metadata", (n) =>
    s.registerTool(
      n,
      { description: "Node metadata", inputSchema: { nodeId: z.string() } },
      async ({ nodeId }) =>
        text(`<frame id="${nodeId}" name="Kibo › Tickets / Arbre" x="0" y="0" width="1440" height="900" />`),
    ),
  );
  tool("get_screenshot", (n) =>
    s.registerTool(n, { description: "Node screenshot", inputSchema: { nodeId: z.string() } }, async () => ({
      content: [{ type: "image" as const, data: FAKE_PNG_BASE64, mimeType: "image/png" }],
    })),
  );
  tool("slow", (n) =>
    s.registerTool(n, { description: "Slow", inputSchema: { ms: z.number() } }, async ({ ms }) => {
      await Bun.sleep(ms);
      return text("late");
    }),
  );
  tool("fail", (n) =>
    s.registerTool(n, { description: "Fails" }, async () => ({ isError: true, ...text("boom") })),
  );
  tool("big", (n) =>
    s.registerTool(n, { description: "Big", inputSchema: { bytes: z.number() } }, async ({ bytes }) =>
      text("x".repeat(bytes)),
    ),
  );
  tool("env", (n) =>
    s.registerTool(n, { description: "Env" }, async () =>
      text(
        JSON.stringify({
          keys: Object.keys(process.env).sort(),
          cwd: process.cwd(),
          hasToken: Boolean(process.env.FAKE_TOKEN),
        }),
      ),
    ),
  );
  tool("echo_env", (n) =>
    s.registerTool(n, { description: "Echoes its secret in an error" }, async () => ({
      isError: true,
      ...text(`invalid token ${process.env.FAKE_TOKEN ?? ""}`),
    })),
  );
  tool("log_env", (n) =>
    s.registerTool(n, { description: "Writes its secret on stderr" }, async () => {
      process.stderr.write(`token ${process.env.FAKE_TOKEN ?? ""}\n`);
      return text("logged");
    }),
  );
  s.registerResource(
    "echo",
    new ResourceTemplate("fake://echo/{value}", { list: undefined }),
    { mimeType: "text/plain" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/plain", text: uri.href }] }),
  );
  s.registerResource("items", "fake://items", { mimeType: "application/json" }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(FAKE_ITEMS) }],
  }));
  return s;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.from(c));
  return chunks.length === 0 ? undefined : JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function listeningPort(http: Server): number {
  const address = http.address();
  if (address === null || typeof address === "string")
    throw new Error("fake MCP server is not listening on TCP");
  return address.port;
}

export async function startFakeMcpHttp(
  opts: { bearer?: string; omit?: string[]; port?: number } = {},
): Promise<{ url: string; stop(): Promise<void> }> {
  const http = createServer((req, res) => {
    if (opts.bearer && req.headers.authorization !== `Bearer ${opts.bearer}`) {
      res.writeHead(401).end();
      return;
    }
    const server = buildFakeMcpServer({ omit: opts.omit });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    server
      .connect(transport)
      .then(() => readJson(req))
      .then((body) => transport.handleRequest(req, res, body))
      .catch((e: unknown) => {
        console.error("[fake-mcp] request failed", e);
        if (!res.headersSent) res.writeHead(500).end();
      });
  });
  const sockets = new Set<Socket>();
  http.on("connection", (socket: Socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => http.listen(opts.port ?? 0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${listeningPort(http)}/mcp`,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        http.close((e) => (e ? reject(e) : resolve()));
        for (const socket of sockets) socket.destroy();
      }),
  };
}
