import { KiboError, Link, type TicketView } from "@kibo/schema";
import { explainError } from "../error-text";
import { frLinks } from "../fr-links";
import { lookupTicket } from "../tickets/ticket-view";
import { printJson, type SessionIo } from "./daemon-session";
import { notFound, type TicketsContext } from "./tickets-context";

type Pair = { from: TicketView; to: TicketView };

function pairOf(fromKey: string, toKey: string, { snapshot, io }: TicketsContext): Pair | number {
  const from = lookupTicket(snapshot.tickets, fromKey);
  if (!from) return notFound(fromKey, io);
  const to = lookupTicket(snapshot.tickets, toKey);
  if (!to) return notFound(toKey, io);
  return { from, to };
}

function linkFailure(e: unknown, { from, to }: Pair, io: SessionIo): number {
  if (!(e instanceof KiboError)) throw e;
  const text = e.code === "LINK_CYCLE" ? frLinks.cycle(from.keyLabel, to.keyLabel) : explainError(e);
  if (text === null) throw e;
  io.err(text);
  return 1;
}

async function addBlocks(pair: Pair, ctx: TicketsContext): Promise<Link> {
  const command = { method: "addLink", from: pair.from.id, to: pair.to.id, type: "blocks" } as const;
  return Link.parse(await ctx.client.rpc({ method: "command", projectId: ctx.snapshot.meta.id, command }));
}

export async function linkCommand(ident: string, ctx: TicketsContext): Promise<number> {
  const pair = pairOf(ident, typeof ctx.flags.blocks === "string" ? ctx.flags.blocks : "", ctx);
  if (typeof pair === "number") return pair;
  let link: Link;
  try {
    link = await addBlocks(pair, ctx);
  } catch (e) {
    return linkFailure(e, pair, ctx.io);
  }
  if (ctx.flags.json === true) printJson(ctx.io, link);
  else ctx.io.out(frLinks.linked(pair.from.keyLabel, pair.to.keyLabel));
  return 0;
}

export async function unlinkCommand(ident: string, other: string, ctx: TicketsContext): Promise<number> {
  const pair = pairOf(ident, other, ctx);
  if (typeof pair === "number") return pair;
  const { from, to } = pair;
  const link = ctx.snapshot.links.find((l) => l.type === "blocks" && l.from === from.id && l.to === to.id);
  if (!link) {
    ctx.io.err(frLinks.notLinked(from.keyLabel, to.keyLabel));
    return 1;
  }
  const command = { method: "removeLink", linkId: link.id } as const;
  await ctx.client.rpc({ method: "command", projectId: ctx.snapshot.meta.id, command });
  if (ctx.flags.json === true) printJson(ctx.io, link);
  else ctx.io.out(frLinks.unlinked(from.keyLabel, to.keyLabel));
  return 0;
}
