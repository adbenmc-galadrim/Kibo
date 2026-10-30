import type { ProjectDelivery, RunView } from "@kibo/schema";
import type { OrchestratorOptions } from "./orchestrator-types";
import { PROJECT_WORKSPACE_LABEL } from "./project-run";
import type { createTurnPreparer, PreparedTurn } from "./run-prepare";

export type Prepared = {
  turn: PreparedTurn;
  cwd: string;
  label: string;
  guidelines: number;
  delivery: ProjectDelivery | null;
};

type RunTurnsDeps = {
  opts: OrchestratorOptions;
  preparer: ReturnType<typeof createTurnPreparer>;
};

export function createRunTurns(deps: RunTurnsDeps) {
  async function project(run: RunView, runDir: string): Promise<Prepared> {
    const project = await deps.opts.projectTurns.prepare(run, runDir);
    const turn = deps.preparer.prepare(run, runDir, {
      kind: "project",
      systemPrompt: project.systemPrompt,
      brief: project.prompt,
    });
    return { turn, cwd: project.cwd, label: PROJECT_WORKSPACE_LABEL, guidelines: 0, delivery: null };
  }

  return { project };
}
