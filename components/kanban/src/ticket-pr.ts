import type { CiRun, GithubPrRef, TicketView } from "@kibo/schema";

const LIVE: ReadonlySet<GithubPrRef["state"]> = new Set(["open", "draft"]);

const latest = (prs: readonly GithubPrRef[]): GithubPrRef | null =>
  prs.reduce<GithubPrRef | null>((best, pr) => (best === null || pr.number > best.number ? pr : best), null);

export function ticketPr(ticket: Pick<TicketView, "externalRefs">): GithubPrRef | null {
  const prs = ticket.externalRefs.filter((r): r is GithubPrRef => r.kind === "github_pr");
  return latest(prs.filter((pr) => LIVE.has(pr.state))) ?? latest(prs);
}

export const isLivePr = (pr: Pick<GithubPrRef, "state">): boolean => LIVE.has(pr.state);

export const ticketCiRuns = (ticket: Pick<TicketView, "key">, runs: readonly CiRun[]): CiRun[] =>
  ticket.key === null ? [] : runs.filter((r) => r.ticketKey === ticket.key);
