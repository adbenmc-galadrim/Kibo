import { MODIFYING_TOOLS } from "@kibo/schema";
import type { HookSink } from "../agents/hook-route";

export type WriteDeps = {
  onWrite(runId: string, absPath: string): void | Promise<void>;
  log?: (line: string) => void;
};

export function withOverlapWrites(sink: HookSink, deps: WriteDeps): HookSink {
  const log = deps.log ?? ((line: string) => console.error(`[kibo-daemon] ${line}`));
  return {
    verify: (runId, token) => sink.verify(runId, token),
    receive(runId, payload, toolInput) {
      const reply = sink.receive(runId, payload, toolInput);
      const path = payload.detail;
      if (payload.event === "PostToolUse" && MODIFYING_TOOLS.includes(payload.tool ?? "") && path) {
        Promise.resolve()
          .then(() => deps.onWrite(runId, path))
          .catch((e: unknown) => log(`overlaps: check of ${path} for run ${runId} failed: ${String(e)}`));
      }
      return reply;
    },
  };
}
