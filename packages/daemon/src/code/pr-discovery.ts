import { branchRefOf, type ExternalRef, type GithubPrRef, type PrInfo, type PrState } from "@kibo/schema";
import { call, type Service } from "../service";
import { completeMerge, isFollowed, recordPr, triggerRules } from "./pr-rules";
import { prsForBranch } from "./remote-ops";
import type { Env } from "./run";

export type Candidate = {
  projectId: string;
  folder: string;
  ticketId: string;
  branch: string;
  known: GithubPrRef[];
};

const RANK: Record<PrState, number> = { open: 0, draft: 0, merged: 1, closed: 2 };

export const pickPr = (prs: readonly PrInfo[]): PrInfo | null =>
  [...prs].sort((a, b) => RANK[a.state] - RANK[b.state] || b.number - a.number)[0] ?? null;

const isPr = (ref: ExternalRef): ref is GithubPrRef => ref.kind === "github_pr";

export function discoveryCandidates(service: Service): Candidate[] {
  const candidates: Candidate[] = [];
  for (const project of call(service, { method: "listProjects" })) {
    const folder = project.folder;
    if (!folder) continue;
    for (const ticket of call(service, { method: "getProject", projectId: project.id }).tickets) {
      const branch = branchRefOf(ticket.externalRefs)?.branch;
      if (!branch || ticket.statusId === "done" || ticket.externalRefs.some(isFollowed)) continue;
      const known = ticket.externalRefs.filter(isPr);
      candidates.push({ projectId: project.id, folder, ticketId: ticket.id, branch, known });
    }
  }
  return candidates;
}

export async function findPr(candidate: Candidate, env: Env): Promise<PrInfo | null> {
  return pickPr(await prsForBranch(candidate.branch, candidate.folder, env));
}

const same = (ref: GithubPrRef, info: PrInfo): boolean =>
  ref.state === info.state && ref.base === info.base && ref.head === info.head;

export function attachPr(service: Service, candidate: Candidate, info: PrInfo): void {
  const { projectId, ticketId } = candidate;
  const previous = candidate.known.find((r) => r.url === info.url) ?? null;
  if (previous && same(previous, info)) return;
  const ref: GithubPrRef = { kind: "github_pr", ...info };
  recordPr(service, projectId, ticketId, ref);
  if (info.state === "open") triggerRules(service, projectId, { kind: "pr_opened", ticketId });
  if (info.state === "merged" && previous?.state !== "merged")
    completeMerge(service, projectId, ticketId, ref);
}
