import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { KiboError, type McpServerInput, type McpToolInfo, type SecretName } from "@kibo/schema";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { Resolver } from "../components/net-proxy-address";
import type { SecretResolver } from "../integrations/types";
import { createPinnedFetch } from "./http-fetch";
import { BunStdioTransport } from "./stdio-transport";

export type McpConnection = {
  tools: McpToolInfo[];
  resources: string[];
  client: Client;
  close(): Promise<void>;
};
export type ConnectionDeps = {
  home: string;
  secret: SecretResolver;
  resolve: Resolver;
  timeoutMs: number;
  signal: AbortSignal;
  onClose(): void;
  report(error: unknown): void;
};
type Stdio = Extract<McpServerInput, { transport: "stdio" }>;
type Http = Extract<McpServerInput, { transport: "http" }>;
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

async function secretOrFail(deps: ConnectionDeps, name: SecretName): Promise<string> {
  const v = await deps.secret(name);
  if (v === null) throw new KiboError("NOT_CONNECTED", `secret ${name} is missing`);
  return v;
}

async function stdioTransport(s: Stdio, deps: ConnectionDeps): Promise<Transport> {
  const cwd = join(deps.home, "mcp", s.id);
  mkdirSync(cwd, { recursive: true, mode: 0o700 });
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    HOME: process.env.HOME ?? homedir(),
    LANG: process.env.LANG ?? "C.UTF-8",
  };
  for (const name of s.envNames) env[name] = await secretOrFail(deps, `mcp:${s.id}:${name}`);
  return new BunStdioTransport({ id: s.id, cmd: [s.command, ...s.args], env, cwd });
}

async function httpTransport(s: Http, deps: ConnectionDeps): Promise<Transport> {
  const url = new URL(s.url);
  const headers: Record<string, string> = s.bearer
    ? { authorization: `Bearer ${await secretOrFail(deps, `mcp:${s.id}`)}` }
    : {};
  if (LOOPBACK.has(url.hostname)) return new StreamableHTTPClientTransport(url, { requestInit: { headers } });
  return new StreamableHTTPClientTransport(url, {
    requestInit: { headers },
    fetch: createPinnedFetch({ resolve: deps.resolve }),
  });
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function handshake(client: Client, timeout: number): Promise<Omit<McpConnection, "client" | "close">> {
  const listed = await client.listTools(undefined, { timeout });
  const resources = client.getServerCapabilities()?.resources
    ? (await client.listResources(undefined, { timeout })).resources.map((r) => r.uri)
    : [];
  return {
    resources,
    tools: listed.tools.map((t) => ({
      name: t.name,
      description: t.description ?? null,
      inputSchema: t.inputSchema,
    })),
  };
}

export async function openMcpConnection(s: McpServerInput, deps: ConnectionDeps): Promise<McpConnection> {
  const transport = s.transport === "stdio" ? await stdioTransport(s, deps) : await httpTransport(s, deps);
  if (deps.signal.aborted) throw new KiboError("MCP_UNAVAILABLE", `${s.id}: connection cancelled`);
  const client = new Client({ name: "kibo", version: "0.5.0" });
  client.onclose = deps.onClose;
  let closing: Promise<void> | null = null;
  const abort = () => {
    closing = client.close();
  };
  deps.signal.addEventListener("abort", abort, { once: true });
  try {
    await client.connect(transport, { timeout: deps.timeoutMs });
    const listed = await handshake(client, deps.timeoutMs);
    return { ...listed, client, close: () => client.close() };
  } catch (e) {
    await (closing ?? client.close()).catch(deps.report);
    throw new KiboError("MCP_UNAVAILABLE", `${s.id}: ${messageOf(e)}`);
  } finally {
    deps.signal.removeEventListener("abort", abort);
  }
}
