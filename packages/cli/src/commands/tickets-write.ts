import { frTickets } from "../fr";
import type { TicketsContext } from "./tickets-context";

const notYet = ({ io }: TicketsContext): number => {
  io.err(frTickets.usage);
  return 2;
};

export async function createCommand(_title: string, ctx: TicketsContext): Promise<number> {
  return notYet(ctx);
}

export async function updateCommand(_ident: string, ctx: TicketsContext): Promise<number> {
  return notYet(ctx);
}

export async function moveCommand(_ident: string, ctx: TicketsContext): Promise<number> {
  return notYet(ctx);
}
