import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  Agent,
  AutoLink,
  Overlap,
  OverlapStatus,
  ProjectMeta,
  RunMoment,
  RunMomentsPage,
  RunView,
  Ticket,
} from "@kibo/schema";
import { testAgent } from "../agents/agents-port.test-helper";
import { fakeContexts, fakeWrites } from "../agents/fake-claude-ai";
import { releaseFakeRun } from "../agents/fake-claude-scenario";
import { repo } from "../agents/git-test-kit";
import {
  agentsOf,
  type Rpc,
  type Stack,
  startStack,
  waitFor,
} from "../project-agent/integration.test-helper";

export const WORKTREE_AGENT: Agent = testAgent({
  id: "livraison",
  name: "livraison",
  workspace: "worktree",
  maxParallel: 6,
});
export const REPO_AGENT: Agent = testAgent({
  id: "livraison-repo",
  name: "livraison-repo",
  workspace: "repo",
  maxParallel: 6,
});

export type Boutique = { stack: Stack; project: ProjectMeta; tickets: Map<string, Ticket>; folder: string };

export async function startBoutique(key = "BOU", count = 18): Promise<Boutique> {
  const stack = await startStack("overlap-routes", [WORKTREE_AGENT, REPO_AGENT]);
  const folder = await repo();
  const project = await createProject(stack.rpc, "Boutique", key, folder, count);
  return { stack, folder, ...project };
}

export async function createProject(
  rpc: Rpc,
  name: string,
  key: string,
  folder: string | null,
  count: number,
) {
  const project = await rpc<ProjectMeta>({ method: "createProject", name, key, folder, color: "#F97316" });
  const tickets = new Map<string, Ticket>();
  for (let n = 1; n <= count; n++) {
    const ticket = await rpc<Ticket>({
      method: "command",
      projectId: project.id,
      command: { method: "createTicket", title: `Ticket ${n}`, statusId: "todo" },
    });
    tickets.set(`${key}-${n}`, ticket);
  }
  return { project, tickets };
}

export function assign(
  b: Pick<Boutique, "stack" | "project" | "tickets">,
  key: string,
  agent: Agent = WORKTREE_AGENT,
): Promise<RunView> {
  return b.stack.rpc<RunView>({
    method: "assignAgent",
    projectId: b.project.id,
    ticketId: b.tickets.get(key)?.id,
    profileId: agent.ref,
    brief: "",
  });
}

const fakeDir = (stack: Stack) => join(stack.home, "fake");

export const contextsOf = (stack: Stack, run: RunView) =>
  fakeContexts(fakeDir(stack), run.sessionId).map((c) => c.additionalContext);
export const writesOf = (stack: Stack, run: RunView) => fakeWrites(fakeDir(stack), run.sessionId);
export const release = (stack: Stack, run: RunView) => releaseFakeRun(fakeDir(stack), run.sessionId);
export function briefOf(stack: Stack, run: RunView): string {
  const path = join(stack.home, "runs", run.id, "brief.md");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

export const overlapsOf = (rpc: Rpc, projectId: string, state?: OverlapStatus) =>
  rpc<Overlap[]>({ method: "overlaps.list", projectId, ...(state && { state }) });
export const autoLinksOf = (rpc: Rpc, projectId: string) =>
  rpc<AutoLink[]>({ method: "autoLinks.list", projectId });

export async function momentsOf(rpc: Rpc, runId: string): Promise<RunMoment[]> {
  return (await rpc<RunMomentsPage>({ method: "runMoments", runId })).moments;
}

export const kindsOf = (moments: readonly RunMoment[]) => moments.map((m) => m.data.kind);

export function finished(rpc: Rpc, runId: string): Promise<RunView> {
  return waitFor(async () => {
    const run = (await agentsOf(rpc)).runs.find((r) => r.id === runId);
    return run && (run.state === "done" || run.state === "failed") ? run : undefined;
  });
}

export function wrote(stack: Stack, run: RunView, count: number): Promise<true> {
  return waitFor(async () => (writesOf(stack, run).length >= count ? true : undefined));
}

export const until = <T>(read: () => Promise<T | undefined>) => waitFor(read, 45_000);
