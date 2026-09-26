import {
  CodeEvent,
  type CodeRequest,
  type CodeResult,
  type ComponentCall,
  KiboError,
  type ProjectCommand,
  type RpcRequest,
  type RpcResponse,
  type RpcResult,
  type RunChanged,
  type RunState,
  type TicketRun,
  type Topic,
  ticketRuns,
} from "@kibo/schema";
import type { ProjectBackend } from "./types";

export type KiboClient = {
  rpc<R extends RpcRequest>(req: R): Promise<RpcResult[R["method"]]>;
  code<R extends CodeRequest>(req: R): Promise<CodeResult[R["method"]]>;
  pair(token: string): Promise<void>;
  subscribe(listener: (projectId: string | null) => void): () => void;
  subscribeTopic(topic: Topic, listener: () => void): () => void;
  onRunChanged(listener: (e: RunChanged) => void): () => void;
  subscribeCode(listener: (event: CodeEvent) => void): () => void;
  online(): boolean;
  onConnection(listener: () => void): () => void;
};

export type ClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
  onUnauthorized?: () => void;
};

export function createClient(opts: ClientOptions): KiboClient {
  const f = opts.fetch ?? fetch;
  const post = (path: string, body: unknown) =>
    f(`${opts.baseUrl}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const call = async (path: string, body: unknown): Promise<unknown> => {
    const res = await post(path, body);
    if (res.status === 401) {
      opts.onUnauthorized?.();
      throw new KiboError("UNAUTHORIZED", "pairing required");
    }
    const payload = (await res.json()) as RpcResponse;
    if (!payload.ok) throw new KiboError(payload.error.code, payload.error.message);
    return payload.result;
  };

  const listeners = new Set<(projectId: string | null) => void>();
  const topics = new Map<Topic, Set<() => void>>();
  const runListeners = new Set<(e: RunChanged) => void>();
  const codeListeners = new Set<(event: CodeEvent) => void>();
  const statusListeners = new Set<() => void>();
  let socket: WebSocket | null = null;
  let open = false;
  const setOpen = (value: boolean) => {
    if (open === value) return;
    open = value;
    for (const l of statusListeners) l();
  };
  const active = () =>
    listeners.size +
    runListeners.size +
    codeListeners.size +
    [...topics.values()].reduce((n, set) => n + set.size, 0);

  const connect = () => {
    const url = new URL("/api/events", opts.baseUrl || globalThis.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(url);
    socket.onopen = () => setOpen(true);
    socket.onmessage = (e) => {
      const data: unknown = JSON.parse(String(e.data));
      const code = CodeEvent.safeParse(data);
      if (code.success) {
        for (const l of codeListeners) l(code.data);
        return;
      }
      const msg = data as {
        projectId?: string | null;
        topic?: Topic;
        type?: string;
        runId?: string;
        state?: RunState;
      };
      if (msg.type === "run.changed" && msg.runId && msg.state) {
        for (const l of runListeners) l({ type: "run.changed", runId: msg.runId, state: msg.state });
        return;
      }
      if (msg.topic) {
        for (const l of topics.get(msg.topic) ?? []) l();
        return;
      }
      for (const l of listeners) l(msg.projectId ?? null);
    };
    socket.onclose = () => {
      socket = null;
      setOpen(false);
      if (active() > 0) setTimeout(connect, 1000);
    };
  };
  const release = () => {
    if (active() === 0) socket?.close();
  };

  return {
    async rpc<R extends RpcRequest>(req: R): Promise<RpcResult[R["method"]]> {
      return (await call("/api/rpc", req)) as RpcResult[R["method"]];
    },
    async code<R extends CodeRequest>(req: R): Promise<CodeResult[R["method"]]> {
      return (await call("/api/code", req)) as CodeResult[R["method"]];
    },
    async pair(token) {
      const res = await post("/api/pair", { token });
      if (res.status !== 204) throw new KiboError("UNAUTHORIZED", "invalid pairing token");
    },
    subscribe(listener) {
      listeners.add(listener);
      if (!socket) connect();
      return () => {
        listeners.delete(listener);
        release();
      };
    },
    subscribeTopic(topic, listener) {
      const set = topics.get(topic) ?? new Set<() => void>();
      set.add(listener);
      topics.set(topic, set);
      if (!socket) connect();
      return () => {
        set.delete(listener);
        release();
      };
    },
    onRunChanged(listener) {
      runListeners.add(listener);
      if (!socket) connect();
      return () => {
        runListeners.delete(listener);
        release();
      };
    },
    subscribeCode(listener) {
      codeListeners.add(listener);
      if (!socket) connect();
      return () => {
        codeListeners.delete(listener);
        release();
      };
    },
    online: () => open,
    onConnection(listener) {
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    },
  };
}

export function projectBackend(client: KiboClient, projectId: string, instanceId: string): ProjectBackend {
  return {
    snapshot: () => client.rpc({ method: "getProject", projectId }),
    run: (command: ProjectCommand) => client.rpc({ method: "command", projectId, command }),
    call: (call: ComponentCall) => client.rpc({ method: "componentCall", projectId, instanceId, call }),
    subscribe: (listener) =>
      client.subscribe((id) => {
        if (id === projectId) listener();
      }),
    runs: async (): Promise<TicketRun[]> => ticketRuns(await client.rpc({ method: "getAgents" }), projectId),
    subscribeRuns: (listener) => client.subscribeTopic("agents", listener),
  };
}
