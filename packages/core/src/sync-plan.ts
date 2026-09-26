import {
  projectStatus,
  type StatusId,
  type StatusMap,
  type SyncedField,
  type SyncedFields,
} from "@kibo/schema";

export const SYNCED_FIELDS: readonly SyncedField[] = ["title", "description", "statusId", "closed"];
export type ConflictField = Exclude<SyncedField, "closed">;
export type SyncPlan = {
  push: Partial<SyncedFields>;
  apply: Partial<SyncedFields>;
  conflicts: ConflictField[];
  nextBase: SyncedFields;
};
export type CanApply = (field: SyncedField, value: SyncedFields[SyncedField]) => boolean;

export const canApplyRemote: CanApply = (field, value) => !(field === "statusId" && value === "blocked");

export function normalizeText(s: string): string {
  return s.replace(/\r\n?/g, "\n");
}

export function projectLocal(
  ticket: { title: string; description: string; statusId: StatusId },
  base: SyncedFields,
  map: StatusMap | null,
): SyncedFields {
  const statusId =
    ticket.statusId === base.statusId ? base.statusId : projectStatus(ticket.statusId, map, base.statusId);
  return {
    title: ticket.title.trim(),
    description: normalizeText(ticket.description),
    statusId,
    closed: statusId === "done",
  };
}

function isConflictField(field: SyncedField): field is ConflictField {
  return field !== "closed";
}

function followsBaseStatus(
  field: SyncedField,
  value: SyncedFields[SyncedField],
  nextBase: SyncedFields,
): boolean {
  return field !== "closed" || value === (nextBase.statusId === "done");
}

function reopensWithRefusedStatus(
  field: SyncedField,
  i: { base: SyncedFields; remote: SyncedFields },
): boolean {
  return field === "statusId" && i.base.closed && !i.remote.closed;
}

function planField<K extends SyncedField>(
  field: K,
  i: { base: SyncedFields; local: SyncedFields; remote: SyncedFields },
  canApply: CanApply,
  plan: SyncPlan,
): void {
  const b = i.base[field];
  const l = i.local[field];
  const r = i.remote[field];
  const localChanged = l !== b;
  const remoteChanged = r !== b;
  if (!localChanged && !remoteChanged) return;
  if (localChanged && !remoteChanged) {
    plan.push[field] = l;
    return;
  }
  if (!localChanged) {
    if (canApply(field, r) && followsBaseStatus(field, r, plan.nextBase)) {
      plan.apply[field] = r;
      plan.nextBase[field] = r;
    } else if (reopensWithRefusedStatus(field, i)) {
      plan.apply.statusId = "todo";
      plan.nextBase.statusId = "todo";
    }
    return;
  }
  if (l === r) {
    plan.nextBase[field] = r;
    return;
  }
  if (!canApply(field, r)) {
    plan.push[field] = l;
    return;
  }
  plan.apply[field] = r;
  plan.nextBase[field] = r;
  if (isConflictField(field)) plan.conflicts.push(field);
}

export function planSync(i: {
  base: SyncedFields;
  local: SyncedFields;
  remote: SyncedFields;
  canApply?: CanApply;
}): SyncPlan {
  const plan: SyncPlan = { push: {}, apply: {}, conflicts: [], nextBase: { ...i.base } };
  for (const field of SYNCED_FIELDS) planField(field, i, i.canApply ?? canApplyRemote, plan);
  return plan;
}

function takeReturned<K extends SyncedField>(field: K, base: SyncedFields, returned: SyncedFields): void {
  base[field] = returned[field];
}

function preferReturned<K extends SyncedField>(field: K, plan: SyncPlan, returned: SyncedFields): void {
  delete plan.push[field];
  plan.apply[field] = returned[field];
  plan.nextBase[field] = returned[field];
}

export function settleAfterPush(i: {
  base: SyncedFields;
  pushed: SyncedField[];
  returned: SyncedFields;
  local: SyncedFields;
  canApply?: CanApply;
}): SyncPlan {
  const canApply = i.canApply ?? canApplyRemote;
  const base = { ...i.base };
  for (const field of i.pushed) takeReturned(field, base, i.returned);
  const plan = planSync({ base, local: i.local, remote: i.returned, canApply });
  for (const field of i.pushed) {
    if (field in plan.push && canApply(field, i.returned[field])) preferReturned(field, plan, i.returned);
  }
  return plan;
}

export function canonicalFields(f: SyncedFields): string {
  return JSON.stringify({
    closed: f.closed,
    description: f.description,
    statusId: f.statusId,
    title: f.title,
  });
}
