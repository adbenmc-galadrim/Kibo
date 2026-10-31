import { KiboError, type ProjectCommand, type ProjectSnapshot, Sprint, type TicketView } from "@kibo/schema";
import type { Parsed } from "../args";
import type { DaemonClient } from "../daemon-client";
import { frTickets } from "../fr";
import { frSprints } from "../fr-sprints";
import { endsBeforeStart, type SprintRequest } from "../sprints/sprint-request";
import { findSprint } from "../tickets/find-sprint";
import { lookupTicket } from "../tickets/ticket-view";
import { printJson, type SessionIo } from "./daemon-session";
import { notFound, summaryOf } from "./tickets-context";

type SprintsContext = {
  client: DaemonClient;
  snapshot: ProjectSnapshot;
  flags: Parsed["flags"];
  io: SessionIo;
};

type Of<K extends SprintRequest["kind"]> = Extract<SprintRequest, { kind: K }>;

const send = (ctx: SprintsContext, command: ProjectCommand): Promise<unknown> =>
  ctx.client.rpc({ method: "command", projectId: ctx.snapshot.meta.id, command });

const reread = (ctx: SprintsContext): Promise<ProjectSnapshot> =>
  ctx.client.rpc({ method: "getProject", projectId: ctx.snapshot.meta.id });

function sprintNotFound(raw: string, io: SessionIo): number {
  io.err(frTickets.sprintNotFound(raw));
  return 1;
}

function freshSprint(snapshot: ProjectSnapshot, id: string): Sprint {
  const found = snapshot.sprints.find((s) => s.id === id);
  if (!found) throw new KiboError("NOT_FOUND", `sprint ${id} vanished`);
  return Sprint.parse(found);
}

async function createSprint(req: Of<"create">, ctx: SprintsContext): Promise<number> {
  const { code, name, start, end } = req;
  const sprint = Sprint.parse(await send(ctx, { method: "createSprint", code, name, start, end }));
  if (ctx.flags.json === true) printJson(ctx.io, sprint);
  else ctx.io.out(frSprints.created(sprint));
  return 0;
}

async function updateSprint(req: Of<"update">, ctx: SprintsContext): Promise<number> {
  const sprint = findSprint(ctx.snapshot.sprints, req.target);
  if (!sprint) return sprintNotFound(req.target, ctx.io);
  const next = { ...sprint, ...req.patch };
  if (endsBeforeStart(next)) {
    ctx.io.err(frSprints.endBeforeStart);
    return 1;
  }
  await send(ctx, { method: "updateSprint", sprintId: sprint.id, patch: req.patch });
  if (ctx.flags.json === true) printJson(ctx.io, freshSprint(await reread(ctx), sprint.id));
  else ctx.io.out(frSprints.updated(next));
  return 0;
}

const labelOf = (t: TicketView): string => t.shortKey ?? t.keyLabel;

function featureLabel(step: TicketView, tickets: readonly TicketView[]): string {
  const parent = tickets.find((t) => t.id === step.parentId);
  return parent ? labelOf(parent) : (step.parentId ?? step.keyLabel);
}

function refuseStep(step: TicketView, req: Of<"assign">, ctx: SprintsContext): number {
  const feature = featureLabel(step, ctx.snapshot.tickets);
  const code =
    req.sprint === null ? null : (findSprint(ctx.snapshot.sprints, req.sprint)?.code ?? req.sprint);
  ctx.io.err(code === null ? frSprints.sprintOffStep(feature) : frSprints.sprintOnStep(code, feature));
  return 1;
}

async function assignSprint(req: Of<"assign">, ctx: SprintsContext): Promise<number> {
  const ticket = lookupTicket(ctx.snapshot.tickets, req.ticket);
  if (!ticket) return notFound(req.ticket, ctx.io);
  if (ticket.parentId !== null) return refuseStep(ticket, req, ctx);
  const sprint = req.sprint === null ? null : findSprint(ctx.snapshot.sprints, req.sprint);
  if (req.sprint !== null && sprint === null) return sprintNotFound(req.sprint, ctx.io);
  await send(ctx, { method: "setTicketSprint", ticketId: ticket.id, sprintId: sprint?.id ?? null });
  if (ctx.flags.json === true) printJson(ctx.io, summaryOf(await reread(ctx), ticket.id));
  else
    ctx.io.out(
      sprint ? frSprints.assigned(labelOf(ticket), sprint.code) : frSprints.cleared(labelOf(ticket)),
    );
  return 0;
}

export function runSprintRequest(req: SprintRequest, ctx: SprintsContext): Promise<number> {
  if (req.kind === "create") return createSprint(req, ctx);
  if (req.kind === "update") return updateSprint(req, ctx);
  return assignSprint(req, ctx);
}
