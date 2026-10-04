import { client } from "../api";

export function reportRefusal(projectId: string, instanceId: string, kind: "navigate" | "focus"): void {
  client
    .rpc({ method: "reportComponentRefusal", projectId, instanceId, kind })
    .catch((e: unknown) => console.error(`[kibo-ui] ${kind} refusal of ${instanceId} not recorded`, e));
}
