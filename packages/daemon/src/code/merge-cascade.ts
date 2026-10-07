import type { ExternalRef, GithubPrRef } from "@kibo/schema";

export type PrTicket = { id: string; refs: readonly ExternalRef[] };

const mergedPr = (refs: readonly ExternalRef[]): GithubPrRef | null =>
  refs.find((r): r is GithubPrRef => r.kind === "github_pr" && r.state === "merged") ?? null;

export function mergeCascade(tickets: readonly PrTicket[], mergedHead: string): string[] {
  const done: string[] = [];
  const seen = new Set<string>();
  const queue = [mergedHead];
  for (let head = queue.shift(); head !== undefined; head = queue.shift()) {
    for (const ticket of tickets) {
      const pr = mergedPr(ticket.refs);
      if (pr === null || pr.base !== head || seen.has(ticket.id)) continue;
      seen.add(ticket.id);
      done.push(ticket.id);
      if (pr.head !== null) queue.push(pr.head);
    }
  }
  return done;
}
