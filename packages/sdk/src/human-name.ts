import type { Assignee } from "@kibo/schema";

const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function humanName(ref: string, unknown: string): string {
  return ACCOUNT_ID.test(ref) ? unknown : ref;
}

export function assigneeLabel(assignee: Assignee): string {
  return assignee.ref;
}
