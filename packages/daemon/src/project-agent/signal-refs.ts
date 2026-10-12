import type { BatchContext } from "@kibo/core/project-agent/expected";
import { isOpenSignal } from "@kibo/schema";
import type { ProjectAgentSignalsPort } from "./types";

export type SignalRefsPort = Pick<ProjectAgentSignalsPort, "openRefs" | "list">;

export function signalRefs(
  port: SignalRefsPort,
  projectId: string,
): Pick<BatchContext, "signals" | "closedSignals"> {
  return {
    signals: port.openRefs(projectId),
    closedSignals: port
      .list(projectId)
      .signals.filter((s) => !isOpenSignal(s))
      .map((s) => s.ref),
  };
}
