import type { Parsed } from "../args";
import { frTickets } from "../fr";
import { frFeatures, frWrite } from "../fr-write";
import { findSprint } from "../tickets/find-sprint";
import { type Connect, type SessionIo, withClient } from "./daemon-session";
import { chooseProject } from "./tickets-context";
import { createTicket, editOf, labelsOf, report, send, usage, type WriteContext } from "./write-support";

const VALUE_FLAGS = ["project", "sprint", "description", "labels"];

async function createFeature(title: string, ctx: WriteContext): Promise<number> {
  const edit = editOf(ctx);
  if (edit !== null && ("usage" in edit || edit.kind !== "replace"))
    return usage(ctx, "usage" in edit ? edit.usage : null, frFeatures.usage);
  const wanted = typeof ctx.flags.sprint === "string" ? ctx.flags.sprint : null;
  const sprint = wanted === null ? null : findSprint(ctx.snapshot.sprints, wanted);
  if (wanted !== null && sprint === null) {
    ctx.io.err(frTickets.sprintNotFound(wanted));
    return 1;
  }
  const created = await createTicket(ctx, {
    method: "createTicket",
    title,
    feature: true,
    description: edit?.text,
    labels: labelsOf(ctx),
  });
  if (sprint !== null)
    await send(ctx, { method: "setTicketSprint", ticketId: created.id, sprintId: sprint.id });
  const key = created.shortKey ?? created.key ?? created.id;
  return report(ctx, created.id, frWrite.created(key, title, sprint === null ? [] : [sprint.code]));
}

export async function featuresCommand(
  positional: readonly string[],
  flags: Parsed["flags"],
  io: SessionIo,
  connect?: Connect,
  cwd: string = process.cwd(),
  stdin?: () => string,
): Promise<number> {
  const [sub, title] = positional;
  if (
    sub !== "create" ||
    !title ||
    VALUE_FLAGS.some((name) => typeof flags[name] !== "string" && flags[name] !== undefined)
  ) {
    io.err(frFeatures.usage);
    return 2;
  }
  const project = typeof flags.project === "string" ? flags.project : undefined;
  return withClient(
    io,
    async (client) => {
      const choice = chooseProject(await client.rpc({ method: "listProjects" }), "", project, cwd);
      if ("problem" in choice) {
        io.err(choice.problem);
        return choice.code;
      }
      const snapshot = await client.rpc({ method: "getProject", projectId: choice.project.id });
      return createFeature(title, { client, snapshot, flags, io, cwd, stdin });
    },
    connect,
  );
}
