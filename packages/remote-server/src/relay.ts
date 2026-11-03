import type { SealedRequest, ServerMessage } from "@kibo/remote/protocol";
import { KiboError } from "@kibo/schema";

type Pending = { resolve(sealed: SealedRequest): void; reject(error: KiboError): void; timer: Timer };

export type Relay = {
  send(sealed: SealedRequest): Promise<SealedRequest>;
  reply(requestId: string, sealed: SealedRequest): boolean;
  failAll(): void;
};

const MAX_PENDING = 64;

const macGone = () => new KiboError("REMOTE_UNAVAILABLE", "the mac is not connected");

export function createRelay(deps: { deliver(message: ServerMessage): boolean; timeoutMs: number }): Relay {
  const pending = new Map<string, Pending>();
  const settle = (requestId: string): Pending | undefined => {
    const entry = pending.get(requestId);
    if (!entry) return undefined;
    clearTimeout(entry.timer);
    pending.delete(requestId);
    return entry;
  };
  return {
    send: (sealed) => {
      const { requestId } = sealed.header;
      if (pending.has(requestId))
        return Promise.reject(new KiboError("INVALID_INPUT", "request already pending"));
      if (pending.size >= MAX_PENDING)
        return Promise.reject(
          new KiboError("RATE_LIMITED", `${MAX_PENDING} requests already wait for the mac`),
        );
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          settle(requestId)?.reject(
            new KiboError("TIMEOUT", `the mac did not answer within ${deps.timeoutMs} ms`),
          );
        }, deps.timeoutMs);
        pending.set(requestId, { resolve, reject, timer });
        if (!deps.deliver({ type: "request", requestId, sealed })) settle(requestId)?.reject(macGone());
      });
    },
    reply: (requestId, sealed) => {
      const entry = settle(requestId);
      entry?.resolve(sealed);
      return entry !== undefined;
    },
    failAll: () => {
      for (const requestId of [...pending.keys()]) settle(requestId)?.reject(macGone());
    },
  };
}
