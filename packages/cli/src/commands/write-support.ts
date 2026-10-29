import { KiboError, type ProjectCommand, Ticket, type TicketView } from "@kibo/schema";
import { flagText, splitList } from "../args";
import { frTickets } from "../fr";
import { frWrite } from "../fr-write";
import { readTextArg } from "../text-source";
import { type DescriptionEdit, descriptionEditOf, EXCLUSIVE_EDITS } from "../tickets/description-edit";
import { featureOf } from "../tickets/feature-target";
import { printJson } from "./daemon-session";
import { notFound, summaryOf, type TicketsContext } from "./tickets-context";

export type WriteContext = TicketsContext & { stdin?: () => string };
export type Usage = { usage: string | null };

export async function send(ctx: WriteContext, command: ProjectCommand): Promise<unknown> {
  return ctx.client.rpc({ method: "command", projectId: ctx.snapshot.meta.id, command });
}

export async function createTicket(
  ctx: WriteContext,
  command: Extract<ProjectCommand, { method: "createTicket" }>,
): Promise<Ticket> {
  return Ticket.parse(await send(ctx, command));
}

export function labelsOf(ctx: WriteContext): string[] | undefined {
  const raw = flagText(ctx.flags, "labels");
  return raw === null ? undefined : splitList(raw);
}

export function editOf(ctx: WriteContext): DescriptionEdit | null | Usage {
  try {
    return descriptionEditOf(ctx.flags, (raw) => readTextArg(raw, ctx.cwd, ctx.stdin));
  } catch (e) {
    if (e instanceof KiboError && e.detail === EXCLUSIVE_EDITS) return { usage: frWrite.exclusive };
    throw e;
  }
}

export function usage(ctx: WriteContext, problem: string | null, text: string = frTickets.usage): number {
  if (problem !== null) ctx.io.err(problem);
  ctx.io.err(text);
  return 2;
}

export function targetOf(ctx: WriteContext, raw: string): TicketView | number {
  try {
    return featureOf(ctx.snapshot, raw);
  } catch (e) {
    if (e instanceof KiboError && e.code === "NOT_FOUND") return notFound(raw, ctx.io);
    throw e;
  }
}

export const featureLabel = (feature: TicketView): string => feature.shortKey ?? feature.keyLabel;

export async function report(ctx: WriteContext, ticketId: string, line: string): Promise<number> {
  if (ctx.flags.json !== true) {
    ctx.io.out(line);
    return 0;
  }
  const fresh = await ctx.client.rpc({ method: "getProject", projectId: ctx.snapshot.meta.id });
  printJson(ctx.io, summaryOf(fresh, ticketId));
  return 0;
}
