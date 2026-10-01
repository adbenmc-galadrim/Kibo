import { servePreviewBackend } from "./preview-backend";
import type { PreviewPort } from "./preview-protocol";
import type { PreviewWorker } from "./worker-backend";

type Listener = (e: MessageEvent) => void;

export type InMemoryWorkers = {
  spawn(): PreviewWorker;
  crash(): void;
  sentToWorker: unknown[];
  spawned(): number;
  terminated(): number;
  toWorker(data: unknown): void;
};

export function inMemoryWorkers(): InMemoryWorkers {
  const sides = { host: new Set<Listener>(), worker: new Set<Listener>() };
  const sentToWorker: unknown[] = [];
  const crashes = new Set<(e: Event) => void>();
  let spawned = 0;
  let terminated = 0;
  const deliver = (to: keyof typeof sides, data: unknown) =>
    queueMicrotask(() => {
      for (const l of sides[to]) l(new MessageEvent("message", { data }));
    });
  const endpoint = (self: keyof typeof sides, other: keyof typeof sides): PreviewPort => ({
    postMessage: (data) => {
      if (other === "worker") sentToWorker.push(data);
      deliver(other, data);
    },
    addEventListener: (_type, l) => sides[self].add(l),
    removeEventListener: (_type, l) => sides[self].delete(l),
  });
  return {
    spawn: () => {
      spawned++;
      servePreviewBackend(endpoint("worker", "host"));
      return {
        port: endpoint("host", "worker"),
        onError: (l) => crashes.add(l),
        terminate: () => {
          terminated++;
        },
      };
    },
    crash: () => {
      for (const l of crashes) l(new Event("error"));
    },
    sentToWorker,
    spawned: () => spawned,
    terminated: () => terminated,
    toWorker: (data) => deliver("worker", data),
  };
}
