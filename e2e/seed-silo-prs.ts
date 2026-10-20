import {
  ExternalRef,
  type GitBranchRef,
  type GithubPrRef,
  type ProjectCommand,
} from "../packages/schema/src/index";
import { type FakeGhPr, siloGhState } from "./fixtures/silo-gh";
import { type PrChecksSpec, type PrReviewSpec, prUrl, siloKey } from "./fixtures/silo-maquettes";
import {
  type BranchSeed,
  type PrSeed,
  SILO_PRS_BRANCHES,
  SILO_PRS_IN_PROGRESS,
  SILO_PRS_REFS,
} from "./fixtures/silo-prs";
import { field } from "./record-field";
import { type SeedOptions, type SeedResult, type SeedRpc, seedSiloMaquettes } from "./seed-silo-maquettes";

export type SeededTicket = { id: string; statusId: unknown; refs: ExternalRef[] };

const refsOf = (ticket: unknown): ExternalRef[] => {
  const raw = field(ticket, "externalRefs");
  return (Array.isArray(raw) ? raw : []).flatMap((r) => {
    const parsed = ExternalRef.safeParse(r);
    return parsed.success ? [parsed.data] : [];
  });
};

export async function ticketsByKey(rpc: SeedRpc, projectId: string): Promise<Map<string, SeededTicket>> {
  const tickets = field(await rpc({ method: "getProject", projectId }), "tickets");
  if (!Array.isArray(tickets)) throw new Error("the Silo project has no ticket list");
  const byKey = new Map<string, SeededTicket>();
  for (const t of tickets) {
    const key = field(t, "key");
    const id = field(t, "id");
    if (typeof key === "string" && typeof id === "string")
      byKey.set(key, { id, statusId: field(t, "statusId"), refs: refsOf(t) });
  }
  return byKey;
}

const sameBranch = (ref: ExternalRef, seed: BranchSeed): boolean =>
  ref.kind === "git_branch" && ref.branch === seed.branch && ref.base === seed.base;

const branchRef = (seed: BranchSeed): GitBranchRef => ({
  kind: "git_branch",
  branch: seed.branch,
  base: seed.base,
});

const prOf = (refs: readonly ExternalRef[], seed: PrSeed): GithubPrRef | null =>
  refs.find((r): r is GithubPrRef => r.kind === "github_pr" && r.url === prUrl(seed.number)) ?? null;

const samePr = (ref: GithubPrRef, seed: PrSeed): boolean =>
  ref.state === seed.state &&
  ref.review === seed.review &&
  ref.checks === seed.checks &&
  ref.base === seed.base &&
  ref.head === seed.head;

const prRef = (previous: GithubPrRef | null, seed: PrSeed): GithubPrRef => ({
  ...(previous ?? {}),
  kind: "github_pr",
  url: prUrl(seed.number),
  number: seed.number,
  state: seed.state,
  review: seed.review,
  checks: seed.checks,
  base: seed.base,
  head: seed.head,
});

function seeded(tickets: Map<string, SeededTicket>, n: number): SeededTicket {
  const ticket = tickets.get(siloKey(n));
  if (ticket === undefined) throw new Error(`${siloKey(n)} was not seeded`);
  return ticket;
}

export type PrsSeedOptions = SeedOptions & { stackPrs(): void | Promise<void> };

type PrWrite = { ticketId: string; previous: GithubPrRef | null; seed: PrSeed };

function prWrites(tickets: Map<string, SeededTicket>): PrWrite[] {
  return SILO_PRS_REFS.flatMap((seed) => {
    const ticket = seeded(tickets, seed.n);
    const previous = prOf(ticket.refs, seed);
    return previous !== null && samePr(previous, seed) ? [] : [{ ticketId: ticket.id, previous, seed }];
  });
}

export async function seedSiloPrs(rpc: SeedRpc, options: PrsSeedOptions): Promise<SeedResult> {
  const result = await seedSiloMaquettes(rpc, options);
  const { projectId } = result;
  const tickets = await ticketsByKey(rpc, projectId);
  const command = (cmd: ProjectCommand) => rpc({ method: "command", projectId, command: cmd });
  for (const n of SILO_PRS_IN_PROGRESS) {
    const ticket = seeded(tickets, n);
    if (ticket.statusId !== "in_progress")
      await command({ method: "setStatus", ticketId: ticket.id, statusId: "in_progress" });
  }
  for (const seed of SILO_PRS_BRANCHES) {
    const ticket = seeded(tickets, seed.n);
    if (!ticket.refs.some((r) => sameBranch(r, seed)))
      await command({ method: "upsertExternalRef", ticketId: ticket.id, ref: branchRef(seed) });
  }
  const writes = prWrites(tickets);
  const write = ({ ticketId, previous, seed }: PrWrite) =>
    command({ method: "upsertExternalRef", ticketId, ref: prRef(previous, seed) });
  for (const w of writes.filter((x) => x.previous === null)) await write(w);
  await options.stackPrs();
  for (const w of writes.filter((x) => x.previous !== null)) await write(w);
  return result;
}

export type FakeGhStackedPr = FakeGhPr & { base?: string; head?: string };

const REVIEW_DECISIONS: Record<PrReviewSpec, string> = {
  none: "",
  approved: "APPROVED",
  changes_requested: "CHANGES_REQUESTED",
};
const ROLLUPS: Record<PrChecksSpec, FakeGhPr["statusCheckRollup"]> = {
  ok: [{ status: "COMPLETED", conclusion: "SUCCESS" }],
  error: [{ status: "COMPLETED", conclusion: "FAILURE" }],
  running: [{ status: "IN_PROGRESS", conclusion: null }],
};

const ghPrOf = (seed: PrSeed): FakeGhStackedPr => ({
  number: seed.number,
  url: prUrl(seed.number),
  state: "OPEN",
  isDraft: seed.state === "draft",
  reviewDecision: REVIEW_DECISIONS[seed.review],
  statusCheckRollup: ROLLUPS[seed.checks],
  base: seed.base,
  head: seed.head,
});

export function siloPrsGhState(options: { merged: boolean }): FakeGhStackedPr[] {
  const seeds = new Map(SILO_PRS_REFS.map((s) => [s.number, s]));
  const known = siloGhState(options).map((pr): FakeGhStackedPr => {
    const seed = seeds.get(pr.number);
    return seed === undefined ? pr : { ...pr, base: seed.base, head: seed.head };
  });
  const listed = new Set(known.map((pr) => pr.number));
  return [...known, ...SILO_PRS_REFS.filter((s) => !listed.has(s.number)).map(ghPrOf)];
}
