import type { HookPayload } from "@kibo/schema";
import { actionFromHook } from "../moments/hook-actions";
import type { HookSink } from "../runs/hook-route";
import type { SkillUses } from "./uses-store";

export type HookUsesDeps = Pick<SkillUses, "record"> & { now?: () => number };

const isSkillCall = (payload: HookPayload): boolean =>
  payload.event === "PostToolUse" && payload.tool === "Skill" && payload.toolUseId !== null;

export function withSkillUses(sink: HookSink, deps: HookUsesDeps): HookSink {
  const now = deps.now ?? Date.now;
  return {
    verify: (runId, token) => sink.verify(runId, token),
    receive(runId, payload, toolInput) {
      const reply = sink.receive(runId, payload, toolInput);
      const action = isSkillCall(payload) ? actionFromHook(payload) : null;
      try {
        if (action !== null) deps.record(runId, [action], now());
      } catch (e) {
        console.error(`[kibo-daemon] skill use of run ${runId} was not counted`, e);
      }
      return reply;
    },
  };
}
