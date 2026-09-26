import { isCompiled } from "@kibo/devkit";
import { type BackendHost, type Channel, createHost, type HostOptions } from "./host-core";

const entry = () =>
  isCompiled() ? "./component-worker.ts" : new URL("./component-worker.ts", import.meta.url).href;

export function createWorkerHost(opts: HostOptions): BackendHost {
  return createHost(
    opts,
    async (handlers): Promise<Channel> => {
      const worker = new Worker(entry());
      worker.addEventListener("message", (e: MessageEvent) => handlers.message(e.data));
      worker.addEventListener("error", (e: ErrorEvent) => handlers.exit(e.message));
      worker.addEventListener("close", () => handlers.exit("closed"));
      return { send: (m) => worker.postMessage(m), close: () => worker.terminate() };
    },
    true,
  );
}
