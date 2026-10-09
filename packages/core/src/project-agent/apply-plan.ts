import {
  type Actor,
  type ExpectedState,
  KiboError,
  type ProjectCommand,
  type ProjectSnapshot,
  type ProposedAction,
} from "@kibo/schema";
import { sameJson } from "../canonical-json";
import { type BatchContext, capture } from "./expected";
import { isNewRef, ticketRefsOf } from "./refs";

export type RefTable = ReadonlyMap<string, { ticketId: string; key: string }>;
export type TicketIds = Record<string, string>;
export type ResolvedRefs = { ok: true; ids: TicketIds } | { ok: false; reason: string };

function resolveRef(ref: string, refs: RefTable, project: ProjectSnapshot): string | { reason: string } {
  if (isNewRef(ref)) return refs.get(ref)?.ticketId ?? { reason: `dépend de ${ref} (échouée)` };
  return project.tickets.find((t) => t.key === ref)?.id ?? { reason: `ticket ${ref} introuvable` };
}

export function resolveRefs(action: ProposedAction, refs: RefTable, project: ProjectSnapshot): ResolvedRefs {
  const ids: TicketIds = {};
  for (const ref of ticketRefsOf(action)) {
    const id = resolveRef(ref, refs, project);
    if (typeof id !== "string") return { ok: false, reason: id.reason };
    ids[ref] = id;
  }
  return { ok: true, ids };
}

export function staleReason(
  action: ProposedAction,
  expected: ExpectedState,
  ctx: BatchContext,
  ids: TicketIds,
): string | null {
  const now = capture(action, ctx, (ref) => ctx.project.tickets.find((t) => t.id === ids[ref]) ?? null);
  const changed = Object.keys(expected.fields).filter(
    (field) => !sameJson(expected.fields[field], now[field]),
  );
  return changed.length > 0 ? `modifié depuis la proposition : ${changed.join(", ")}` : null;
}

function idOf(ids: TicketIds, ref: string): string {
  const id = ids[ref];
  if (id === undefined) throw new KiboError("INVALID_INPUT", `unresolved ticket reference ${ref}`);
  return id;
}

function updateCommands(
  action: Extract<ProposedAction, { type: "updateTicket" }>,
  ids: TicketIds,
  project: ProjectSnapshot,
): ProjectCommand[] {
  const ticketId = idOf(ids, action.ticket);
  const { title, description, labels, parent } = action;
  const edits = [title, description, labels].some((v) => v !== undefined)
    ? [{ method: "updateTicket" as const, ticketId, title, description, labels }]
    : [];
  if (parent === undefined) return edits;
  const parentId = parent === null ? null : idOf(ids, parent);
  const current = project.tickets.find((t) => t.id === ticketId)?.parentId ?? null;
  return parentId === current ? edits : [...edits, { method: "moveTicket", ticketId, parentId }];
}

function unlinkCommand(
  action: Extract<ProposedAction, { type: "unlink" }>,
  ids: TicketIds,
  project: ProjectSnapshot,
) {
  const [from, to] = [idOf(ids, action.from), idOf(ids, action.to)];
  const found = project.links.find(
    (l) =>
      l.type === action.kind &&
      ((l.from === from && l.to === to) || (action.kind === "relates" && l.from === to && l.to === from)),
  );
  if (!found)
    throw new KiboError("NOT_FOUND", `no ${action.kind} link between ${action.from} and ${action.to}`);
  return { method: "removeLink" as const, linkId: found.id };
}

export function commandsFor(
  action: ProposedAction,
  ids: TicketIds,
  by: Actor,
  project: ProjectSnapshot,
): ProjectCommand[] {
  switch (action.type) {
    case "createTicket": {
      const { title, description, statusId, blockedReason, labels, parent } = action;
      const parentId = parent === undefined ? null : idOf(ids, parent);
      return [{ method: "createTicket", title, description, statusId, blockedReason, labels, parentId }];
    }
    case "updateTicket":
      return updateCommands(action, ids, project);
    case "setStatus":
      return [
        {
          method: "setStatus",
          ticketId: idOf(ids, action.ticket),
          statusId: action.statusId,
          reason: action.blockedReason,
        },
      ];
    case "link":
      return [{ method: "addLink", from: idOf(ids, action.from), to: idOf(ids, action.to), type: "blocks" }];
    case "unlink":
      return [unlinkCommand(action, ids, project)];
    case "answerQuestion":
      return [{ method: "answerQuestion", questionId: action.questionId, answer: action.answer, by }];
    case "createQuestion": {
      const { title, context, options, provisional, blocking } = action;
      const ticketId = idOf(ids, action.ticket);
      return [
        {
          method: "createQuestion",
          ticketId,
          title,
          context,
          options,
          provisional,
          blocking,
          createdBy: by,
          runId: null,
        },
      ];
    }
    case "assignAgent":
    case "deliverAnswers":
    case "cancelRun":
    case "createNote":
    case "updateNote":
      return [];
  }
}

export const isSkipped = (action: ProposedAction, chosen: ReadonlySet<number>): boolean =>
  !chosen.has(action.id);
