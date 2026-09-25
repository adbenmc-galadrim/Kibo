import {
  KiboError,
  type ProjectCommand,
  type RpcRequest,
  type RpcResponse,
  type RpcResult,
} from "@kibo/schema";
import type { ProjectBackend } from "./types";

export type KiboClient = {
  rpc<R extends RpcRequest>(req: R): Promise<RpcResult[R["method"]]>;
  pair(token: string): Promise<void>;
  subscribe(listener: (projectId: string | null) => void): () => void;
};

export type ClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
  onUnauthorized?: () => void;
};

export function createClient(opts: ClientOptions): KiboClient {
  const f = opts.fetch ?? fetch;
  const listeners = new Set<(projectId: string | null) => void>();
  let socket: WebSocket | null = null;

  const post = (path: string, body: unknown) =>
    f(`${opts.baseUrl}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  const connect = () => {
    const url = new URL("/api/events", opts.baseUrl || globalThis.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(url);
    socket.onmessage = (e) => {
      const { projectId } = JSON.parse(String(e.data)) as { projectId: string | null };
      for (const l of listeners) l(projectId);
    };
    socket.onclose = () => {
      socket = null;
      if (listeners.size > 0) setTimeout(connect, 1000);
    };
  };

  return {
    async rpc<R extends RpcRequest>(req: R): Promise<RpcResult[R["method"]]> {
      const res = await post("/api/rpc", req);
      if (res.status === 401) {
        opts.onUnauthorized?.();
        throw new KiboError("UNAUTHORIZED", "pairing required");
      }
      const body = (await res.json()) as RpcResponse;
      if (!body.ok) throw new KiboError(body.error.code, body.error.message);
      return body.result as RpcResult[R["method"]];
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
        if (listeners.size === 0) socket?.close();
      };
    },
  };
}

export function projectBackend(client: KiboClient, projectId: string): ProjectBackend {
  return {
    snapshot: () => client.rpc({ method: "getProject", projectId }),
    run: (command: ProjectCommand) => client.rpc({ method: "command", projectId, command }),
    subscribe: (listener) =>
      client.subscribe((id) => {
        if (id === projectId) listener();
      }),
  };
}
