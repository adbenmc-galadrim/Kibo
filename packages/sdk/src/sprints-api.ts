import type { CommandResult, ProjectCommand, SprintView } from "@kibo/schema";
import type { SdkContext, SprintsApi } from "./types";

type SprintDeps = {
  list(type: "sprint"): Promise<SprintView[]>;
  run<C extends ProjectCommand>(cmd: C): Promise<CommandResult[C["method"]]>;
  open(sprintId: string): void;
};

export function sprintsApi(deps: SprintDeps): SprintsApi {
  return {
    list: () => deps.list("sprint"),
    create: (input) => deps.run({ method: "createSprint", ...input }),
    async update(sprintId, patch) {
      await deps.run({ method: "updateSprint", sprintId, patch });
    },
    async remove(sprintId) {
      await deps.run({ method: "deleteSprint", sprintId });
    },
    async assign(ticketId, sprintId) {
      await deps.run({ method: "setTicketSprint", ticketId, sprintId });
    },
    open: deps.open,
  };
}

export function openSprintOf(ctx: SdkContext): (sprintId: string) => void {
  return (sprintId) => {
    if (ctx.openSprint) ctx.openSprint(sprintId);
    else console.warn(`[kibo-sdk] ${ctx.instanceId}: no host to open sprint ${sprintId}`);
  };
}
