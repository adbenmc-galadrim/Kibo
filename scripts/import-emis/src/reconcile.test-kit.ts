import { join } from "node:path";
import {
  type ExternalRef,
  externalRefKey,
  type ImportRef,
  KiboError,
  type Link,
  type PrInfo,
  type ProjectCommand,
  type Ticket,
} from "@kibo/schema";
import { type Desired, desiredState } from "./desired";
import { loadEmisFiles } from "./emis-files";
import { loadAnswers, loadPlan } from "./plan-source";
import { type ReconcileSnapshot, type Reconciliation, resolveCommand } from "./reconcile";

export const FIXTURE = join(import.meta.dir, "..", "fixtures", "emis");

export function fixtureDesired(notesDir = "/notes", prs = new Map<number, PrInfo>()): Desired {
  const plan = loadPlan(join(FIXTURE, "tmp", "plan-data.js"));
  return desiredState({
    plan,
    answers: loadAnswers(join(FIXTURE, "tmp", "reponses.json")),
    files: loadEmisFiles(FIXTURE, join(FIXTURE, "emis")),
    repoUrl: plan.meta.repo,
    prs,
    notesDir,
  });
}

export const ref = (source: string, id: string): ImportRef => ({ kind: "import_ref", source, id });
export const emptySnapshot = (): ReconcileSnapshot => ({ tickets: [], links: [] });

export function withTicket(snapshot: ReconcileSnapshot, patch: Partial<Ticket>): ReconcileSnapshot {
  const n = snapshot.tickets.length + 1;
  const ticket: Ticket = {
    id: `t${n}`,
    key: `EMIS-${n}`,
    pendingSeq: null,
    title: "Sans titre",
    description: "",
    statusId: "todo",
    blockedReason: null,
    domainId: null,
    assignee: null,
    parentId: null,
    externalRefs: [],
    labels: [],
    ...patch,
  };
  return { ...snapshot, tickets: [...snapshot.tickets, ticket] };
}

const upsert = (refs: ExternalRef[], r: ExternalRef): ExternalRef[] => [
  ...refs.filter((e) => e.kind !== r.kind || externalRefKey(e) !== externalRefKey(r)),
  r,
];

function editTicket(
  snapshot: ReconcileSnapshot,
  id: string,
  change: (t: Ticket) => Ticket,
): ReconcileSnapshot {
  if (!snapshot.tickets.some((t) => t.id === id)) throw new KiboError("NOT_FOUND", `ticket ${id}`);
  return { ...snapshot, tickets: snapshot.tickets.map((t) => (t.id === id ? change(t) : t)) };
}

function applyCommand(snapshot: ReconcileSnapshot, c: ProjectCommand): ReconcileSnapshot {
  switch (c.method) {
    case "createTicket": {
      const { method: _m, blockedReason, ...fields } = c;
      return withTicket(snapshot, { ...fields, blockedReason: blockedReason ?? null });
    }
    case "updateTicket": {
      const { method: _m, ticketId, ...patch } = c;
      return editTicket(snapshot, ticketId, (t) => ({ ...t, ...patch }));
    }
    case "setStatus":
      return editTicket(snapshot, c.ticketId, (t) => ({
        ...t,
        statusId: c.statusId,
        blockedReason: c.reason ?? null,
      }));
    case "moveTicket":
      return editTicket(snapshot, c.ticketId, (t) => ({ ...t, parentId: c.parentId }));
    case "upsertExternalRef":
      return editTicket(snapshot, c.ticketId, (t) => ({ ...t, externalRefs: upsert(t.externalRefs, c.ref) }));
    case "addLink": {
      const link: Link = { id: `l${snapshot.links.length + 1}`, from: c.from, to: c.to, type: c.type };
      return { ...snapshot, links: [...snapshot.links, link] };
    }
    default:
      throw new KiboError("INVALID_INPUT", `unexpected command ${c.method}`);
  }
}

export function applyLocally(snapshot: ReconcileSnapshot, plan: Reconciliation): ReconcileSnapshot {
  let current = snapshot;
  const ids = new Map<string, string>();
  for (const [index, raw] of plan.commands.entries()) {
    current = applyCommand(current, resolveCommand(raw, ids));
    const placeholder = plan.defines.get(index);
    const created = current.tickets.at(-1);
    if (placeholder && created) ids.set(placeholder, created.id);
  }
  return current;
}
