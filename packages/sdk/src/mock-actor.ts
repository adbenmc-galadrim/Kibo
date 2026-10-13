import type { Actor, ProjectCommand } from "@kibo/schema";

const actorFor = (sent: Actor, viewer: string): Actor =>
  sent.kind === "import" ? sent : { kind: "human", ref: viewer };

export function actAs(cmd: ProjectCommand, viewer: string): ProjectCommand {
  switch (cmd.method) {
    case "createQuestion":
      return { ...cmd, createdBy: actorFor(cmd.createdBy, viewer) };
    case "answerQuestion":
    case "updateQuestion":
    case "updateAnswer":
    case "reopenQuestion":
    case "archiveQuestion":
    case "restoreQuestion":
      return { ...cmd, by: actorFor(cmd.by, viewer) };
    default:
      return cmd;
  }
}
