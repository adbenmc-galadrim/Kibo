import type { Assignee, MemberInfo } from "@kibo/schema";

const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function memberName(ref: string, members: readonly MemberInfo[], unknown: string): string {
  return members.find((m) => m.userId === ref)?.name ?? (ACCOUNT_ID.test(ref) ? unknown : ref);
}

export function assigneeLabel(assignee: Assignee, members: MemberInfo[]): string {
  if (assignee.kind === "agent") return assignee.ref;
  return members.find((m) => m.userId === assignee.ref)?.name ?? assignee.ref;
}
