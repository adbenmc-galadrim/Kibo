import { openConnection, type RemoteConnection } from "./connection";
import type { RemoteTimers } from "./timers";

type RevokerDeps = {
  timers: RemoteTimers;
  now(): number;
  log(line: string): void;
  onRevoked(): Promise<void>;
};

export type Revoker = { start(input: { serverUrl: string; macToken: string }): void; stop(): void };

export function createRevoker(deps: RevokerDeps): Revoker {
  let connection: RemoteConnection | null = null;
  const stop = () => {
    connection?.close();
    connection = null;
  };
  return {
    start: ({ serverUrl, macToken }) => {
      stop();
      const current = openConnection({
        serverUrl,
        macToken,
        timers: deps.timers,
        now: deps.now,
        log: deps.log,
        onOpen: () => {
          current.send({ type: "phone.revoke" });
          current.send({ type: "ping", at: deps.now() });
        },
        onMessage: (message) => {
          if (message.type !== "pong" || connection !== current) return;
          stop();
          deps
            .onRevoked()
            .catch((e: unknown) => deps.log(`[kibo-daemon] remote revocation not cleaned up: ${String(e)}`));
        },
      });
      connection = current;
    },
    stop,
  };
}
