import type { IntegrationId, IntegrationStatus } from "@kibo/schema";
import type { IntegrationHost, IntegrationProbe } from "./types";

export const baseStatus = (id: IntegrationId, state: IntegrationStatus["state"]): IntegrationStatus => ({
  id,
  state,
  account: null,
  servers: [],
  error: null,
  resumeAt: null,
});

export function builtinProbes(host: IntegrationHost): IntegrationProbe[] {
  return [
    {
      id: "git",
      status: async () =>
        (await host.gitAvailable())
          ? baseStatus("git", "active")
          : { ...baseStatus("git", "error"), error: { code: "NOT_FOUND", message: "git introuvable" } },
    },
    { id: "notifications", status: async () => baseStatus("notifications", "active") },
    { id: "markdown", status: async () => baseStatus("markdown", "connected") },
  ];
}
