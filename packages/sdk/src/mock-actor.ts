import type { Actor, ProjectCommand } from "@kibo/schema";

const actorFor = (sent: Actor, viewer: string): Actor =>
  sent.kind === "import" ? sent : { kind: "human", ref: viewer };

export function actAs(cmd: ProjectCommand, viewer: string): ProjectCommand {
  if (cmd.method === "createQuestion") return { ...cmd, createdBy: actorFor(cmd.createdBy, viewer) };
  if (cmd.method === "answerQuestion") return { ...cmd, by: actorFor(cmd.by, viewer) };
  return cmd;
}
