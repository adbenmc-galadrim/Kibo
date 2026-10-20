import type { ProjectCommand, Ticket } from "@kibo/schema";

export type SeedRun = (cmd: ProjectCommand) => unknown;
export type TicketSeed = Omit<Extract<ProjectCommand, { method: "createTicket" }>, "method">;

export const createSeedTicket = (run: SeedRun, ticket: TicketSeed): Ticket =>
  run({ method: "createTicket", ...ticket }) as Ticket;
