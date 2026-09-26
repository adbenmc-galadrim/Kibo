import { KiboError, type McpServerInput } from "@kibo/schema";
import type { Resolver } from "../components/net-proxy-address";
import type { SecretResolver } from "../integrations/types";
import { type McpConnection, openMcpConnection } from "./connection";

type Live = {
  conn: Promise<McpConnection>;
  abort: AbortController;
  timer: ReturnType<typeof setTimeout> | null;
  busy: number;
};
export type PoolDeps = {
  home: string;
  secret: SecretResolver;
  resolve: Resolver;
  idleMs: number;
  connectTimeoutMs: number;
  onError(id: string, detail: string): void;
  report(error: unknown): void;
};
export type McpPool = {
  connection(id: string): Promise<McpConnection | null>;
  use<T>(id: string, server: McpServerInput, run: (c: McpConnection) => Promise<T>): Promise<T>;
  connect(id: string, server: McpServerInput): Promise<McpConnection>;
  close(id: string): Promise<void>;
  stop(): Promise<void>;
};

export function createMcpPool(deps: PoolDeps): McpPool {
  const live = new Map<string, Live>();
  let stopped = false;

  const failed = (id: string, entry: Live, e: unknown) => {
    if (live.get(id) === entry) live.delete(id);
    if (entry.abort.signal.aborted) return;
    deps.onError(id, e instanceof KiboError ? e.detail : String(e));
  };
  const dropClosed = (id: string, abort: AbortController) => {
    const entry = live.get(id);
    if (entry?.abort !== abort) return;
    live.delete(id);
    if (entry.timer) clearTimeout(entry.timer);
  };
  const open = (id: string, server: McpServerInput): Live => {
    const abort = new AbortController();
    const conn = openMcpConnection(server, {
      home: deps.home,
      secret: deps.secret,
      resolve: deps.resolve,
      timeoutMs: deps.connectTimeoutMs,
      signal: abort.signal,
      onClose: () => dropClosed(id, abort),
      report: deps.report,
    });
    const entry: Live = { conn, abort, timer: null, busy: 0 };
    conn.then(
      () => undefined,
      (e: unknown) => failed(id, entry, e),
    );
    return entry;
  };
  const close = async (id: string) => {
    const entry = live.get(id);
    if (!entry) return;
    live.delete(id);
    if (entry.timer) clearTimeout(entry.timer);
    entry.abort.abort();
    const conn = await entry.conn.catch(() => null);
    if (conn) await conn.close();
  };
  const arm = (id: string, entry: Live) => {
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
    if (live.get(id) !== entry || entry.busy > 0) return;
    entry.timer = setTimeout(() => {
      close(id).catch(deps.report);
    }, deps.idleMs);
  };
  const acquire = async (id: string, server: McpServerInput) => {
    if (stopped) throw new KiboError("MCP_UNAVAILABLE", "mcp hub is stopped");
    let entry = live.get(id);
    if (!entry) {
      entry = open(id, server);
      live.set(id, entry);
    }
    const conn = await entry.conn;
    return { conn, entry };
  };

  return {
    async connection(id) {
      const entry = live.get(id);
      return entry ? entry.conn.catch(() => null) : null;
    },
    async connect(id, server) {
      const { conn, entry } = await acquire(id, server);
      arm(id, entry);
      return conn;
    },
    async use(id, server, run) {
      const { conn, entry } = await acquire(id, server);
      entry.busy += 1;
      arm(id, entry);
      try {
        return await run(conn);
      } finally {
        entry.busy -= 1;
        arm(id, entry);
      }
    },
    close,
    async stop() {
      stopped = true;
      await Promise.all([...live.keys()].map(close));
    },
  };
}
