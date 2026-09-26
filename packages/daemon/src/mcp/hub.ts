import { rmSync } from "node:fs";
import { join } from "node:path";
import {
  KiboError,
  type McpCallResult,
  type McpServerInput,
  type McpServerView,
  type McpToolInfo,
  type SecretName,
} from "@kibo/schema";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type Resolver, systemResolver } from "../components/net-proxy-address";
import type { EventLog } from "../integrations/events";
import type { IntegrationHost, SecretStore } from "../integrations/types";
import { commandLineOf } from "./command-line";
import { createMcpConfigStore } from "./config-store";
import type { McpConnection } from "./connection";
import { createMcpPool } from "./pool";
import { toCallResult, toReadResult } from "./result";

export type McpHub = {
  views(): Promise<McpServerView[]>;
  add(
    input: McpServerInput,
    confirmedCommandLine: string,
    secrets: Record<string, string>,
  ): Promise<McpServerView>;
  remove(id: string): Promise<void>;
  setEnabled(id: string, enabled: boolean): Promise<McpServerView>;
  test(id: string): Promise<McpServerView>;
  tools(id: string): Promise<McpToolInfo[]>;
  call(
    id: string,
    tool: string,
    args: Record<string, unknown>,
    instanceId: string | null,
  ): Promise<McpCallResult>;
  read(id: string, uri: string, instanceId: string | null): Promise<McpCallResult>;
  setReserved(id: "figma", url: string | null): Promise<void>;
  stop(): Promise<void>;
};
export type McpHubDeps = {
  host: IntegrationHost;
  secrets: SecretStore;
  events: EventLog;
  redact(text: string): string;
  idleMs?: number;
  callTimeoutMs?: number;
  resolve?: Resolver;
};
type Secret = { key: string; name: SecretName };

const CONNECT_TIMEOUT_MS = 30_000;
export const MCP_IDLE_MS = 10 * 60_000;
export const MCP_CALL_TIMEOUT_MS = 60_000;

function secretsOf(s: McpServerInput): Secret[] {
  if (s.transport === "stdio") return s.envNames.map((n) => ({ key: n, name: `mcp:${s.id}:${n}` }));
  return s.bearer ? [{ key: "bearer", name: `mcp:${s.id}` }] : [];
}

function callError(id: string, tool: string, e: unknown): KiboError {
  if (e instanceof McpError && e.code === ErrorCode.RequestTimeout)
    return new KiboError("TIMEOUT", `${id}/${tool} timed out`);
  if (e instanceof KiboError) return e;
  return new KiboError("MCP_FAILED", `${id}/${tool}: ${e instanceof Error ? e.message : String(e)}`);
}

export function createMcpHub(deps: McpHubDeps): McpHub {
  const { host, secrets, events } = deps;
  const timeoutMs = deps.callTimeoutMs ?? MCP_CALL_TIMEOUT_MS;
  const store = createMcpConfigStore(host.db);
  const reserved = new Map<string, McpServerInput>();
  const errors = new Map<string, string>();
  const report = (e: unknown) => events.log("mcp", "error", `mcp: ${String(e)}`);
  const pool = createMcpPool({
    home: host.home,
    secret: (n) => secrets.get(n),
    resolve: deps.resolve ?? systemResolver,
    idleMs: deps.idleMs ?? MCP_IDLE_MS,
    connectTimeoutMs: CONNECT_TIMEOUT_MS,
    onError(id, detail) {
      errors.set(id, deps.redact(detail));
      events.log("mcp", "error", detail);
    },
    report,
  });
  const logCall = host.db.query<
    null,
    { at: number; server: string; tool: string; instance: string | null; ms: number; ok: number }
  >(
    "INSERT INTO mcp_calls (at, server, tool, instance_id, duration_ms, ok) VALUES ($at, $server, $tool, $instance, $ms, $ok)",
  );

  const configOf = (id: string): { server: McpServerInput; enabled: boolean } => {
    const r = reserved.get(id);
    if (r) return { server: r, enabled: true };
    const s = store.get(id);
    if (!s) throw new KiboError("NOT_FOUND", `mcp server ${id} not found`);
    return s;
  };
  const enabledServer = (id: string): McpServerInput => {
    const { server, enabled } = configOf(id);
    if (!enabled) throw new KiboError("MCP_UNAVAILABLE", `mcp server ${id} is disabled`);
    return server;
  };
  const connect = async (id: string): Promise<McpConnection> => {
    const conn = await pool.connect(id, enabledServer(id));
    errors.delete(id);
    return conn;
  };
  const view = async (id: string): Promise<McpServerView> => {
    const s = store.get(id);
    if (!s) throw new KiboError("NOT_FOUND", `mcp server ${id} not found`);
    const conn = await pool.connection(id);
    const set: string[] = [];
    for (const secret of s.server.transport === "stdio" ? secretsOf(s.server) : [])
      if (await secrets.has(secret.name)) set.push(secret.key);
    const error = errors.get(id) ?? null;
    const state = error ? "error" : conn ? "connected" : "idle";
    return { ...s.server, enabled: s.enabled, state, error, tools: conn?.tools ?? [], secretsSet: set };
  };
  const tryConnect = async (id: string) => {
    try {
      await connect(id);
    } catch (e) {
      if (!(e instanceof KiboError)) throw e;
    }
    return view(id);
  };
  const timed = async <T>(
    id: string,
    tool: string,
    instanceId: string | null,
    run: (c: McpConnection) => Promise<T>,
    ok: (r: T) => boolean,
  ): Promise<T> => {
    const server = enabledServer(id);
    let started = performance.now();
    let success = false;
    let reached = false;
    try {
      return await pool.use(id, server, async (c) => {
        errors.delete(id);
        reached = true;
        started = performance.now();
        const r = await run(c);
        success = ok(r);
        return r;
      });
    } catch (e) {
      throw callError(id, tool, e);
    } finally {
      if (reached) {
        const ms = Math.round(performance.now() - started);
        logCall.run({ at: host.now(), server: id, tool, instance: instanceId, ms, ok: success ? 1 : 0 });
      }
    }
  };

  const checkNew = (input: McpServerInput, confirmed: string, values: Record<string, string>) => {
    if (commandLineOf(input) !== confirmed)
      throw new KiboError("INVALID_INPUT", "command line was not confirmed");
    if (store.get(input.id) || reserved.has(input.id))
      throw new KiboError("INVALID_INPUT", `mcp server ${input.id} already exists`);
    const missing = secretsOf(input).filter((s) => !values[s.key]);
    if (missing.length > 0)
      throw new KiboError("INVALID_INPUT", `missing secret values: ${missing.map((s) => s.key).join(", ")}`);
  };

  return {
    views: async () => Promise.all(store.list().map((s) => view(s.server.id))),
    async add(input, confirmedCommandLine, values) {
      checkNew(input, confirmedCommandLine, values);
      for (const s of secretsOf(input)) await secrets.set(s.name, values[s.key] ?? "");
      host.transaction(() => store.insert(input, confirmedCommandLine, host.now()));
      events.log("mcp", "info", `server ${input.id} added`);
      return tryConnect(input.id);
    },
    async remove(id) {
      const s = store.get(id);
      if (!s) throw new KiboError("NOT_FOUND", `mcp server ${id} not found`);
      await pool.close(id);
      for (const secret of secretsOf(s.server)) await secrets.delete(secret.name);
      store.remove(id);
      errors.delete(id);
      rmSync(join(host.home, "mcp", id), { recursive: true, force: true });
      events.log("mcp", "info", `server ${id} removed`);
    },
    async setEnabled(id, enabled) {
      if (!store.get(id)) throw new KiboError("NOT_FOUND", `mcp server ${id} not found`);
      store.setEnabled(id, enabled);
      if (!enabled) await pool.close(id);
      errors.delete(id);
      return view(id);
    },
    async test(id) {
      await pool.close(id);
      errors.delete(id);
      return tryConnect(id);
    },
    tools: async (id) => (await connect(id)).tools,
    call: (id, tool, args, instanceId) =>
      timed(
        id,
        tool,
        instanceId,
        async (c) =>
          toCallResult(
            await c.client.callTool({ name: tool, arguments: args }, undefined, { timeout: timeoutMs }),
          ),
        (r) => !r.isError,
      ),
    read: (id, uri, instanceId) =>
      timed(
        id,
        "resources/read",
        instanceId,
        async (c) => toReadResult(await c.client.readResource({ uri }, { timeout: timeoutMs })),
        () => true,
      ),
    async setReserved(id, url) {
      await pool.close(id);
      errors.delete(id);
      if (url === null) reserved.delete(id);
      else reserved.set(id, { transport: "http", id, name: "Figma", url, bearer: false });
    },
    stop: () => pool.stop(),
  };
}
