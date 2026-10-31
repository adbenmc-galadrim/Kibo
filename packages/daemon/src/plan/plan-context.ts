import type { BatchContext } from "@kibo/core/project-agent/expected";
import type { ProjectAgentDataPort } from "../project-agent/types";

export function planContext(data: ProjectAgentDataPort, projectId: string): BatchContext {
  return {
    project: data.project(projectId),
    runs: [],
    notes: [],
    viewer: data.viewer(projectId),
  };
}
