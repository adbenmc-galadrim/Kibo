import { InstanceSource, type TicketView } from "@kibo/schema";

export function readSource(config: Record<string, unknown>): InstanceSource | null {
  const parsed = InstanceSource.safeParse(config.source);
  return parsed.success ? parsed.data : null;
}

export function matchesSource(ticket: TicketView, source: InstanceSource | null): boolean {
  if (source === null) return true;
  return ticket.externalRefs.some((r) => r.kind === "github_issue" && r.bindingId === source.bindingId);
}
