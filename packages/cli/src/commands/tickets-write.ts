import type { ProjectCommand } from "@kibo/schema";
import { flagText } from "../args";
import { frWrite } from "../fr-write";
import { editDescription } from "../tickets/description-edit";
import { lookupTicket } from "../tickets/ticket-view";
import { notFound, type TicketsContext } from "./tickets-context";
import { createTicket, editOf, featureLabel, labelsOf, report, send, targetOf, usage } from "./write-support";

type UpdateTicket = Extract<ProjectCommand, { method: "updateTicket" }>;

export async function createCommand(title: string, ctx: TicketsContext): Promise<number> {
  const edit = editOf(ctx);
  if (edit !== null && "usage" in edit) return usage(ctx, edit.usage);
  if (edit !== null && edit.kind !== "replace") return usage(ctx, null);
  const feature = targetOf(ctx, flagText(ctx.flags, "feature") ?? "");
  if (typeof feature === "number") return feature;
  const created = await createTicket(ctx, {
    method: "createTicket",
    title,
    parentId: feature.id,
    description: edit?.text,
    labels: labelsOf(ctx),
  });
  const optional = ctx.flags.optional === true;
  if (optional) await send(ctx, { method: "setTicketOptional", ticketId: created.id, optional: true });
  const key = created.key ?? created.id;
  const line = frWrite.created(
    key,
    frWrite.inFeature(title, featureLabel(feature)),
    optional ? [frWrite.optional] : [],
  );
  return report(ctx, created.id, line);
}

export async function updateCommand(ident: string, ctx: TicketsContext): Promise<number> {
  const ticket = lookupTicket(ctx.snapshot.tickets, ident);
  if (!ticket) return notFound(ident, ctx.io);
  const edit = editOf(ctx);
  if (edit !== null && "usage" in edit) return usage(ctx, edit.usage);
  const command: UpdateTicket = { method: "updateTicket", ticketId: ticket.id };
  const parts: string[] = [];
  const title = flagText(ctx.flags, "title");
  if (title !== null) {
    command.title = title;
    parts.push(frWrite.parts.title);
  }
  if (edit !== null) {
    command.description = editDescription(ticket.description, edit);
    parts.push(frWrite.parts.description);
  }
  const labels = labelsOf(ctx);
  if (labels !== undefined) {
    command.labels = labels;
    parts.push(frWrite.parts.labels);
  }
  if (parts.length === 0) return usage(ctx, frWrite.nothingToUpdate);
  await send(ctx, command);
  return report(ctx, ticket.id, frWrite.updated(ticket.keyLabel, parts));
}

export async function moveCommand(ident: string, ctx: TicketsContext): Promise<number> {
  const ticket = lookupTicket(ctx.snapshot.tickets, ident);
  if (!ticket) return notFound(ident, ctx.io);
  const feature = targetOf(ctx, flagText(ctx.flags, "feature") ?? "");
  if (typeof feature === "number") return feature;
  await send(ctx, { method: "moveTicket", ticketId: ticket.id, parentId: feature.id });
  return report(ctx, ticket.id, frWrite.moved(ticket.keyLabel, featureLabel(feature)));
}
