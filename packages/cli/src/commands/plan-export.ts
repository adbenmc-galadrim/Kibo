import type { Parsed } from "../args";
import { frTickets } from "../fr";
import { frPlan } from "../fr-plan";
import { planMarkdown } from "../plan/plan-markdown";
import { type Connect, findProject, type SessionIo, withClient } from "./daemon-session";
import { missingProject } from "./project-hint";

export async function planExport(flags: Parsed["flags"], io: SessionIo, connect?: Connect): Promise<number> {
  const wanted = flags.project;
  if (wanted === undefined) return missingProject(io, frPlan.usage, connect);
  if (typeof wanted !== "string") {
    io.err(frPlan.usage);
    return 2;
  }
  return withClient(
    io,
    async (client) => {
      const project = findProject(await client.rpc({ method: "listProjects" }), wanted);
      if (!project) {
        io.err(frTickets.projectNotFound(wanted));
        return 1;
      }
      const snapshot = await client.rpc({ method: "getProject", projectId: project.id });
      io.out(planMarkdown(snapshot).trimEnd());
      return 0;
    },
    connect,
  );
}
