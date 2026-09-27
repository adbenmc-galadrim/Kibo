import type { Assignee, MemberInfo, PresencePeer } from "@kibo/schema";

export function assigneeLabel(assignee: Assignee, members: MemberInfo[]): string {
  if (assignee.kind === "agent") return assignee.ref;
  return members.find((m) => m.userId === assignee.ref)?.name ?? assignee.ref;
}

export function remoteRuns(
  peers: PresencePeer[],
  ticketKey: string | null,
): { label: string; state: string }[] {
  if (ticketKey === null) return [];
  return peers
    .filter((p) => !p.self)
    .flatMap((p) =>
      p.runs
        .filter((r) => r.ticketKey === ticketKey)
        .map((r) => ({ label: `${r.profile} · ${p.name}`, state: r.state })),
    );
}
