import { type PendingAlert, pickAlerts } from "@kibo/core";
import type { HookReply, Overlap, OverlapRole } from "@kibo/schema";
import type { HookSink } from "../runs/hook-route";
import type { OverlapStore } from "./store";

export type DeliveredAlert = { overlapId: string; role: OverlapRole };

export type AlertDeps = {
  pending(runId: string): PendingAlert[];
  delivered(items: DeliveredAlert[], at: number): void;
  now: () => number;
  log?: (line: string) => void;
};

export type RunNames = { runName(runId: string): string; ticketKey(runId: string): string };

const CONTEXT_SEPARATOR = "\n\n";

const accepts = (reply: HookReply | null): boolean =>
  reply === null || (reply.kind === "permission" && reply.decision === "allow");

function withAlerts(reply: HookReply | null, text: string): HookReply {
  const inner = reply?.kind === "permission" ? reply : null;
  return {
    kind: "permission",
    decision: "allow",
    reason: inner?.reason ?? "",
    additionalContext: [inner?.additionalContext, text].filter(Boolean).join(CONTEXT_SEPARATOR),
  };
}

export function withOverlapAlerts(sink: HookSink, deps: AlertDeps): HookSink {
  const log = deps.log ?? ((line: string) => console.error(`[kibo-daemon] ${line}`));
  const deliver = (runId: string, reply: HookReply | null): HookReply | null => {
    try {
      const picked = pickAlerts(deps.pending(runId));
      if (picked.text === null) return reply;
      deps.delivered(picked.delivered, deps.now());
      return withAlerts(reply, picked.text);
    } catch (e) {
      log(`overlaps: alerts of run ${runId} not delivered: ${String(e)}`);
      return reply;
    }
  };
  return {
    verify: (runId, token) => sink.verify(runId, token),
    receive(runId, payload, toolInput) {
      const reply = sink.receive(runId, payload, toolInput);
      if (payload.event !== "PreToolUse" || !accepts(reply)) return reply;
      return deliver(runId, reply);
    },
  };
}

const withRunOf = (o: Overlap, role: OverlapRole): string => (role === "owner" ? o.otherRunId : o.ownerRunId);

export function storeAlerts(store: OverlapStore, names: RunNames): Pick<AlertDeps, "pending" | "delivered"> {
  return {
    pending: (runId) =>
      store.pending(runId).map(({ overlap, role }) => ({
        overlap,
        role,
        withRunName: names.runName(withRunOf(overlap, role)),
        withTicketKey: names.ticketKey(withRunOf(overlap, role)),
      })),
    delivered(items, at) {
      for (const { overlapId, role } of items)
        store.event(overlapId, { type: "delivered", role, by: null, at });
    },
  };
}
