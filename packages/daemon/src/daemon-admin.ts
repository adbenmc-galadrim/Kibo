import { isTerminal } from "@kibo/schema";
import type { startCollab } from "./collab/bootstrap";
import { createProjectSettings } from "./notes/settings";
import { createProjectAdmin, type ProjectAdmin } from "./projects/admin";
import type { Orchestrator } from "./runs/orchestrator";
import type { Service } from "./service";
import type { Store } from "./store";

export type AdminParts = {
  collab: Pick<Awaited<ReturnType<typeof startCollab>>, "syncInfo" | "client" | "hosts">;
  agents(): Orchestrator | null;
};

export function startProjectAdmin(store: Store, service: Service, parts: AdminParts): ProjectAdmin {
  const { collab, agents } = parts;
  return createProjectAdmin({
    docs: service.docs,
    settings: createProjectSettings(store.db),
    icons: service.icons,
    store,
    sharing: (projectId) => collab.syncInfo(projectId),
    activeRuns: (projectId) =>
      agents()
        ?.state()
        .runs.filter((r) => r.projectId === projectId && !isTerminal(r.state)).length ?? 0,
    detach: (projectId) => collab.client.detachProject(projectId),
    isLocked: (projectId) => collab.hosts.isLocked(projectId),
  });
}
