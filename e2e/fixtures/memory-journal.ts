import { executeProjectCommand, readProject } from "../../packages/core/src/index";
import type { GithubPrRef, ProjectCommand, TicketView } from "../../packages/schema/src/index";

type Doc = Parameters<typeof readProject>[0];
export type MemoryEventData = Record<string, string | number | null>;
export type MemoryEvent = { kind: string; ticketId: string | null; data: MemoryEventData };

export function eventOf(cmd: ProjectCommand): MemoryEvent | null {
  switch (cmd.method) {
    case "setStatus":
      return { kind: "status_changed", ticketId: cmd.ticketId, data: { to: cmd.statusId } };
    case "setTicketSprint":
      return { kind: "sprint_set", ticketId: cmd.ticketId, data: { to: cmd.sprintId } };
    case "upsertExternalRef":
      if (cmd.ref.kind === "git_branch")
        return { kind: "branch_created", ticketId: cmd.ticketId, data: { branch: cmd.ref.branch } };
      if (cmd.ref.kind !== "github_pr") return null;
      return {
        kind: cmd.ref.state === "merged" ? "pr_merged" : "pr_opened",
        ticketId: cmd.ticketId,
        data: { number: cmd.ref.number },
      };
    default:
      return null;
  }
}

export function eventPage(events: readonly MemoryEvent[], limit: number) {
  const items = events.map((e, id) => ({ id, ...e })).reverse();
  return { items: items.slice(0, limit), nextBefore: null };
}

const prOf = (t: TicketView, number: number): GithubPrRef | undefined =>
  t.externalRefs.find((r): r is GithubPrRef => r.kind === "github_pr" && r.number === number);

const delivered = (doc: Doc, today: string): Set<string> =>
  new Set(
    readProject(doc, today).tickets.flatMap((t) =>
      t.feature?.status === "delivered" && t.shortKey !== null ? [t.shortKey] : [],
    ),
  );

export function pollerMerge(doc: Doc, today: string, number: number): MemoryEvent {
  const tickets = readProject(doc, today).tickets;
  const ticket = tickets.find((t) => prOf(t, number) !== undefined);
  const pr = ticket === undefined ? undefined : prOf(ticket, number);
  if (ticket === undefined || pr === undefined)
    throw new Error(`no ticket carries the pull request #${number}`);
  const before = delivered(doc, today);
  const run = (command: ProjectCommand) => executeProjectCommand(doc, command);
  run({ method: "upsertExternalRef", ticketId: ticket.id, ref: { ...pr, state: "merged" } });
  run({ method: "setStatus", ticketId: ticket.id, statusId: "done" });
  const fresh = [...delivered(doc, today)].filter((k) => !before.has(k));
  return { kind: "pr_merged", ticketId: ticket.id, data: { number, delivered: fresh[0] ?? null } };
}
