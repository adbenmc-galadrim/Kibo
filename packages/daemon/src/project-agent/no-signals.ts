import type { ProjectAgentSignalsPort } from "./types";

export const NO_SIGNALS: ProjectAgentSignalsPort = {
  markRead: () => [],
  openRefs: () => [],
  openCount: () => 0,
  settle: () => undefined,
  list: (projectId) => ({ signals: [], wakeup: { projectId, lastAt: null, dueAt: null } }),
};
