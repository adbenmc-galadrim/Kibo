import type { Actor, ProjectCommand } from "@kibo/schema";
import type { CommandInterceptor } from "../docs";

const viewerActor = (actor: Actor, viewer: string): Actor =>
  actor.kind === "import" ? actor : { kind: "human", ref: viewer };

function rewrite(cmd: ProjectCommand, viewer: () => string): ProjectCommand {
  switch (cmd.method) {
    case "createQuestion": {
      const createdBy = viewerActor(cmd.createdBy, viewer());
      return createdBy === cmd.createdBy ? cmd : { ...cmd, createdBy };
    }
    case "answerQuestion": {
      const by = viewerActor(cmd.by, viewer());
      return by === cmd.by ? cmd : { ...cmd, by };
    }
    default:
      return cmd;
  }
}

export function questionActorInterceptor(viewerOf: (projectId: string) => string): CommandInterceptor {
  return (projectId, cmd, meta) => (meta.origin === "user" ? rewrite(cmd, () => viewerOf(projectId)) : cmd);
}
