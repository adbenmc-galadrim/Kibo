import { DaemonToBackend } from "@kibo/schema";
import { createRuntime } from "./runtime-core";

declare const self: Worker;

const runtime = createRuntime((m) => self.postMessage(m), null);
self.addEventListener("message", (e: MessageEvent) => {
  const parsed = DaemonToBackend.safeParse(e.data);
  if (!parsed.success) {
    console.error(`[kibo-worker] invalid message: ${parsed.error.message}`);
    return;
  }
  runtime.handle(parsed.data);
});
