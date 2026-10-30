import { isTerminal } from "@kibo/schema";
import { createProjectSettings } from "./notes/settings";
import { createProjectAdmin, type ProjectAdmin } from "./projects/admin";
import type { Orchestrator } from "./runs/orchestrator";
import type { Service } from "./service";
import type { Store } from "./store";

export function startProjectAdmin(
  store: Store,
  service: Service,
  agents: () => Orchestrator | null,
): ProjectAdmin {
  return createProjectAdmin({
    docs: service.docs,
    settings: createProjectSettings(store.db),
    icons: service.icons,
    store,
    activeRuns: (projectId) =>
      agents()
        ?.state()
        .runs.filter((r) => r.projectId === projectId && !isTerminal(r.state)).length ?? 0,
  });
}
