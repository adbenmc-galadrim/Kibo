import { branchRefOf, matchBranchToTicket, type StatusId, type TicketView } from "@kibo/schema";
import { triggerRules } from "../code/pr-rules";
import { KIBO_COMMAND } from "../docs";
import { call, type Service } from "../service";
import type { Log } from "./refs-reader";

export type ObserverDeps = { service: Service; refs(folder: string): Promise<string[]>; log: Log };

const NOT_STARTED: ReadonlySet<StatusId> = new Set(["backlog", "todo"]);

const branchOf = (ticket: TicketView): string | null => branchRefOf(ticket.externalRefs)?.branch ?? null;

const tickets = (service: Service, projectId: string): TicketView[] =>
  call(service, { method: "getProject", projectId }).tickets;

const signatureOf = (branches: readonly string[], all: readonly TicketView[]): string => {
  const declared = all.flatMap((t) => {
    const branch = branchOf(t);
    return branch === null ? [] : [`${t.id} ${branch}`];
  });
  return [...branches, "", ...declared.sort()].join("\n");
};

const namedBy = (branch: string, all: readonly TicketView[]): TicketView[] =>
  all.filter((t) => matchBranchToTicket(branch, [t]) !== null);

function ownerOf(branch: string, all: readonly TicketView[], log: Log): TicketView | null {
  if (all.some((t) => branchOf(t) === branch)) return null;
  const id = matchBranchToTicket(branch, all);
  if (id === null) {
    if (namedBy(branch, all).length > 1) log(`branch ${branch} names several tickets, not linked`)(branch);
    return null;
  }
  const owner = all.find((t) => t.id === id) ?? null;
  return owner && branchOf(owner) === null ? owner : null;
}

function linkBranches(service: Service, projectId: string, branches: readonly string[], log: Log): void {
  const all = tickets(service, projectId);
  for (const branch of branches) {
    const owner = ownerOf(branch, all, log);
    if (!owner) continue;
    const ref = { kind: "git_branch" as const, branch, base: null };
    service.docs.run(projectId, { method: "upsertExternalRef", ticketId: owner.id, ref }, KIBO_COMMAND);
    all.splice(all.indexOf(owner), 1, { ...owner, externalRefs: [...owner.externalRefs, ref] });
  }
}

function startBranched(service: Service, projectId: string, branches: ReadonlySet<string>): void {
  for (const ticket of tickets(service, projectId)) {
    const branch = branchOf(ticket);
    if (branch === null || !branches.has(branch) || !NOT_STARTED.has(ticket.statusId)) continue;
    triggerRules(service, projectId, { kind: "branch_created", ticketId: ticket.id });
  }
}

async function observeProject(
  deps: ObserverDeps,
  state: Map<string, string>,
  projectId: string,
  folder: string,
): Promise<void> {
  const branches = await deps.refs(folder);
  if (state.get(projectId) === signatureOf(branches, tickets(deps.service, projectId))) return;
  linkBranches(deps.service, projectId, branches, deps.log);
  startBranched(deps.service, projectId, new Set(branches));
  state.set(projectId, signatureOf(branches, tickets(deps.service, projectId)));
}

export async function observeBranches(deps: ObserverDeps, state: Map<string, string>): Promise<void> {
  for (const project of call(deps.service, { method: "listProjects" })) {
    if (!project.folder) continue;
    await observeProject(deps, state, project.id, project.folder).catch(
      deps.log(`branch observation failed for ${project.key}`),
    );
  }
}
