import type { RuleTrigger } from "@kibo/core/rules";
import { type ExternalRef, type GithubPrRef, integrationBranch, type PrInfo } from "@kibo/schema";
import { call, type Service } from "../service";
import { mergeCascade } from "./merge-cascade";

export const isFollowed = (ref: ExternalRef): ref is GithubPrRef =>
  ref.kind === "github_pr" && (ref.state === "open" || ref.state === "draft");

export const samePr = (ref: GithubPrRef, info: PrInfo): boolean =>
  ref.state === info.state &&
  ref.base === info.base &&
  ref.head === info.head &&
  ref.review === info.review &&
  ref.checks === info.checks &&
  (ref.failedCheck ?? null) === (info.failedCheck ?? null);

export function triggerRules(service: Service, projectId: string, trigger: RuleTrigger): void {
  try {
    service.triggerRules(projectId, trigger);
  } catch (e) {
    console.error(`[kibo-daemon] rules ${trigger.kind} failed for ticket ${trigger.ticketId}`, e);
  }
}

function completeMerge(service: Service, projectId: string, ticketId: string, pr: GithubPrRef): void {
  const snapshot = call(service, { method: "getProject", projectId });
  if (pr.base !== null && pr.base !== integrationBranch(snapshot.meta.worktree)) return;
  triggerRules(service, projectId, { kind: "pr_merged", ticketId });
  if (pr.head === null) return;
  const tickets = snapshot.tickets.map((t) => ({ id: t.id, refs: t.externalRefs }));
  for (const id of mergeCascade(tickets, pr.head))
    if (id !== ticketId) triggerRules(service, projectId, { kind: "pr_merged", ticketId: id });
}

export function recordPr(service: Service, projectId: string, ticketId: string, ref: GithubPrRef): void {
  call(service, { method: "command", projectId, command: { method: "upsertExternalRef", ticketId, ref } });
}

type PrWrite = (ref: GithubPrRef) => void;
type PrTransition = {
  projectId: string;
  ticketId: string;
  previous: GithubPrRef | null;
  ref: GithubPrRef;
};

export function applyPr(service: Service, change: PrTransition, write: PrWrite): void {
  const { projectId, ticketId, previous, ref } = change;
  if (previous && samePr(previous, ref)) return;
  write(ref);
  if (isFollowed(ref) && !(previous && isFollowed(previous)))
    triggerRules(service, projectId, { kind: "pr_opened", ticketId });
  if (ref.state === "merged" && previous?.state !== "merged")
    completeMerge(service, projectId, ticketId, ref);
}
