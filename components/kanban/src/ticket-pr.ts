import { type CiRun, type GithubPrRef, isLivePr, type TicketView } from "@kibo/schema";

const latest = (prs: readonly GithubPrRef[]): GithubPrRef | null =>
  prs.reduce<GithubPrRef | null>((best, pr) => (best === null || pr.number > best.number ? pr : best), null);

export function ticketPr(ticket: Pick<TicketView, "externalRefs">): GithubPrRef | null {
  const prs = ticket.externalRefs.filter((r): r is GithubPrRef => r.kind === "github_pr");
  return latest(prs.filter(isLivePr)) ?? latest(prs);
}

export const ticketCiRuns = (ticket: Pick<TicketView, "key">, runs: readonly CiRun[]): CiRun[] =>
  ticket.key === null ? [] : runs.filter((r) => r.ticketKey === ticket.key);
