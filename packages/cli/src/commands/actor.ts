import type { Actor, ProjectSnapshot } from "@kibo/schema";

export const cliActor = (snapshot: Pick<ProjectSnapshot, "viewer">): Actor => ({
  kind: "human",
  ref: snapshot.viewer ?? "cli",
});
