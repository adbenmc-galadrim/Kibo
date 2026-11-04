import { deriveKeys, type MacMessage, type RemoteKeys, type ServerMessage } from "@kibo/remote";
import { KiboError } from "@kibo/schema";
import { openConnection, type RemoteConnection } from "./connection";
import type { RemoteTimers } from "./timers";

type RequestMessage = Extract<ServerMessage, { type: "request" }>;
type PairCreated = Extract<ServerMessage, { type: "pair.created" }>;

type LinkDeps = {
  timers: RemoteTimers;
  now(): number;
  log(line: string): void;
  onOpen(): void;
  handleRequest(message: RequestMessage): Promise<MacMessage | null>;
};

export type LinkStart = {
  serverUrl: string;
  macToken: string;
  accountId: string;
  rootKey: Uint8Array;
  epoch: number;
};

export type RemoteLink = {
  start(input: LinkStart): Promise<void>;
  rotate(rootKey: Uint8Array, epoch: number): Promise<void>;
  keys(): RemoteKeys | null;
  rootKey(): Uint8Array | null;
  send(message: MacMessage): boolean;
  sendConfirmed(message: MacMessage, timeoutMs: number): Promise<boolean>;
  connected(): boolean;
  opened(timeoutMs: number): Promise<boolean>;
  pairToken(timeoutMs: number): Promise<PairCreated>;
  stop(): void;
};

type Live = { connection: RemoteConnection; accountId: string; rootKey: Uint8Array; keys: RemoteKeys };

export function createLink(deps: LinkDeps): RemoteLink {
  let live: Live | null = null;
  const pairWaiters = new Set<(created: PairCreated) => void>();

  const onMessage = (message: ServerMessage) => {
    if (message.type === "pair.created") {
      for (const resolve of pairWaiters) resolve(message);
      pairWaiters.clear();
      return;
    }
    if (message.type !== "request") return;
    deps.handleRequest(message).then(
      (reply) => {
        if (reply) live?.connection.send(reply);
      },
      (e: unknown) => deps.log(`[kibo-daemon] remote request not answered: ${String(e)}`),
    );
  };

  const stop = () => {
    live?.connection.close();
    live = null;
  };

  return {
    start: async (input) => {
      stop();
      const keys = await deriveKeys(input.rootKey, input.accountId, input.epoch);
      const connection = openConnection({
        serverUrl: input.serverUrl,
        macToken: input.macToken,
        timers: deps.timers,
        now: deps.now,
        log: deps.log,
        onOpen: deps.onOpen,
        onMessage,
      });
      live = { connection, accountId: input.accountId, rootKey: input.rootKey, keys };
    },
    rotate: async (rootKey, epoch) => {
      const current = live;
      if (!current) return;
      const keys = await deriveKeys(rootKey, current.accountId, epoch);
      if (live === current) live = { ...current, rootKey, keys };
    },
    keys: () => live?.keys ?? null,
    rootKey: () => live?.rootKey ?? null,
    send: (message) => live?.connection.send(message) ?? false,
    sendConfirmed: async (message, timeoutMs) =>
      live ? live.connection.sendConfirmed(message, timeoutMs) : false,
    connected: () => live?.connection.connected() ?? false,
    opened: async (timeoutMs) => (live ? live.connection.opened(timeoutMs) : false),
    pairToken: (timeoutMs) =>
      new Promise((resolve, reject) => {
        const done = (created: PairCreated) => {
          clearTimeout(timer);
          resolve(created);
        };
        const timer = setTimeout(() => {
          pairWaiters.delete(done);
          reject(new KiboError("TIMEOUT", "Le serveur n'a pas répondu · réessaie"));
        }, timeoutMs);
        pairWaiters.add(done);
        if (!live?.connection.send({ type: "pair.create" })) {
          pairWaiters.delete(done);
          clearTimeout(timer);
          reject(new KiboError("REMOTE_UNAVAILABLE", "Serveur injoignable · réessaie dans un instant"));
        }
      }),
    stop,
  };
}
