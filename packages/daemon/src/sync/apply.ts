import { type ConflictField, canApplyRemote, planSync, projectLocal, type SyncPlan } from "@kibo/core";
import type { Binding, MappedRemote, SyncedFields, TicketView } from "@kibo/schema";
import type { EventLog } from "../integrations/events";
import type { CommandMeta, IntegrationHost } from "../integrations/types";
import { fieldsHash } from "./hash";
import { IGNORED, type SyncItem, type SyncStore } from "./sync-store";

export const SYNC: CommandMeta = { origin: "sync", instanceId: null };
export type ApplyResult = {
  created: boolean;
  updated: boolean;
  conflicts: { ticketKey: string; field: ConflictField; local: string }[];
};
const NONE: ApplyResult = { created: false, updated: false, conflicts: [] };
type Deps = { host: IntegrationHost; store: SyncStore; events: EventLog };

export const statusMapOf = (b: Binding) => b.config.project?.statusMap ?? null;

export function applyPlan(
  deps: Deps,
  projectId: string,
  ticket: TicketView,
  apply: Partial<SyncedFields>,
): boolean {
  let changed = false;
  if (apply.title !== undefined || apply.description !== undefined) {
    deps.host.command(
      projectId,
      { method: "updateTicket", ticketId: ticket.id, title: apply.title, description: apply.description },
      SYNC,
    );
    changed = true;
  }
  if (apply.statusId !== undefined && apply.statusId !== ticket.statusId) {
    deps.host.command(
      projectId,
      { method: "setStatus", ticketId: ticket.id, statusId: apply.statusId },
      SYNC,
    );
    changed = true;
  }
  return changed;
}

function syncRef(deps: Deps, projectId: string, ticket: TicketView, m: MappedRemote): void {
  const current = ticket.externalRefs.find(
    (r) => r.kind === "github_issue" && r.bindingId === m.ref.bindingId,
  );
  if (JSON.stringify(current) !== JSON.stringify(m.ref)) {
    deps.host.command(projectId, { method: "upsertExternalRef", ticketId: ticket.id, ref: m.ref }, SYNC);
  }
}

function conflictsOf(plan: SyncPlan, ticket: TicketView, local: SyncedFields): ApplyResult["conflicts"] {
  return plan.conflicts.map((field) => ({ ticketKey: ticket.key, field, local: String(local[field]) }));
}

function passes(m: MappedRemote, b: Binding): boolean {
  if (m.fields.closed && !b.config.importClosed) return false;
  return b.config.labels.length === 0 || m.labels.some((l) => b.config.labels.includes(l));
}

function importRemote(deps: Deps, projectId: string, b: Binding, m: MappedRemote): ApplyResult {
  deps.host.transaction(() => {
    const statusId = m.fields.statusId === "blocked" ? "todo" : m.fields.statusId;
    const t = deps.host.command(
      projectId,
      {
        method: "importExternalTicket",
        title: m.fields.title,
        description: m.fields.description,
        statusId,
        ref: m.ref,
      },
      SYNC,
    );
    const local = projectLocal(t, m.fields, statusMapOf(b));
    const base = canApplyRemote("statusId", m.fields.statusId)
      ? m.fields
      : { ...m.fields, statusId: local.statusId, closed: local.closed };
    deps.store.upsertItem({
      bindingId: b.id,
      remoteId: m.remoteId,
      ticketId: t.id,
      base,
      remoteUpdatedAt: m.updatedAt,
      lastPushedHash: null,
    });
  });
  return { ...NONE, created: true };
}

export function applyRemote(
  deps: Deps,
  projectId: string,
  b: Binding,
  m: MappedRemote,
  allowImport: boolean,
): ApplyResult {
  const item = deps.store.item(b.id, m.remoteId);
  if (!item) return allowImport && passes(m, b) ? importRemote(deps, projectId, b, m) : NONE;
  if (item.ticketId === IGNORED) return NONE;
  const ticket = deps.host.snapshot(projectId).tickets.find((t) => t.id === item.ticketId);
  if (!ticket) {
    deps.store.upsertItem({ ...item, ticketId: IGNORED });
    return NONE;
  }
  if (item.lastPushedHash === fieldsHash(m.fields) && JSON.stringify(item.base) === JSON.stringify(m.fields))
    return NONE;
  return merge(deps, projectId, b, item, ticket, m);
}

function merge(
  deps: Deps,
  projectId: string,
  b: Binding,
  item: SyncItem,
  ticket: TicketView,
  m: MappedRemote,
): ApplyResult {
  const local = projectLocal(ticket, item.base, statusMapOf(b));
  const plan = planSync({ base: item.base, local, remote: m.fields });
  let updated = false;
  deps.host.transaction(() => {
    updated = applyPlan(deps, projectId, ticket, plan.apply);
    syncRef(deps, projectId, ticket, m);
    deps.store.upsertItem({ ...item, base: plan.nextBase, remoteUpdatedAt: m.updatedAt });
    if (Object.keys(plan.push).length > 0) {
      deps.store.enqueue({ bindingId: b.id, projectId, ticketId: ticket.id, op: "update" }, deps.host.now());
    }
  });
  const conflicts = conflictsOf(plan, ticket, local);
  for (const c of conflicts) {
    deps.events.log(
      "github-issues",
      "warn",
      `conflict on ${c.ticketKey}.${c.field}: local value "${c.local}" replaced by GitHub`,
    );
    deps.host.broadcast({ type: "sync.conflict", projectId, ticketKey: c.ticketKey, field: c.field });
  }
  return { created: false, updated, conflicts };
}
