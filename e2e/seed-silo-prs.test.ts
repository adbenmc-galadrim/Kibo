import { beforeAll, expect, test } from "bun:test";
import type { GithubPrRef, ProjectSnapshot, RpcRequest, TicketView } from "../packages/schema/src/index";
import { createMemoryDaemon, type MemoryDaemon, memorySeed } from "./fixtures/memory-daemon";
import { siloGhState } from "./fixtures/silo-gh";
import { prUrl, SILO_PROJECT, siloKey } from "./fixtures/silo-maquettes";
import {
  SILO_PRS_BRANCHES,
  SILO_PRS_IN_PROGRESS,
  SILO_PRS_RAIL,
  SILO_PRS_REFS,
  SILO_PRS_STACKS,
} from "./fixtures/silo-prs";
import { seedSiloPrs, siloPrsGhState } from "./seed-silo-prs";

const TODAY = "2026-10-16";
const SEED_WRITES = SILO_PRS_IN_PROGRESS.length + SILO_PRS_BRANCHES.length + SILO_PRS_REFS.length;

const STACKED = "stackPrs";
const SILO_PRS_NEW: readonly number[] = [24, 25];

let daemon: MemoryDaemon;
let sent: (RpcRequest | typeof STACKED)[];
let snapshot: ProjectSnapshot;
let atStacking: ProjectSnapshot | null = null;

beforeAll(async () => {
  daemon = createMemoryDaemon("adam", TODAY);
  sent = [];
  const recorded = async (req: RpcRequest) => {
    sent.push(req);
    return daemon.rpc(req);
  };
  const stackPrs = () => {
    sent.push(STACKED);
    atStacking = daemon.snapshot(SILO_PROJECT.key, TODAY);
  };
  await seedSiloPrs(recorded, { ...memorySeed(daemon), stackPrs });
  snapshot = daemon.snapshot(SILO_PROJECT.key, TODAY);
});

const ticket = (n: number): TicketView => {
  const found = snapshot.tickets.find((t) => t.key === siloKey(n));
  if (found === undefined) throw new Error(`${siloKey(n)} is missing`);
  return found;
};
const livePrs = (): GithubPrRef[] =>
  snapshot.tickets.flatMap((t) =>
    t.externalRefs.flatMap((r) =>
      r.kind === "github_pr" && (r.state === "open" || r.state === "draft") ? [r] : [],
    ),
  );
const branchOf = (n: number) => ticket(n).externalRefs.find((r) => r.kind === "git_branch");

function prNumberOf(r: RpcRequest | typeof STACKED): number | null {
  if (r === STACKED || r.method !== "command" || r.command.method !== "upsertExternalRef") return null;
  return r.command.ref.kind === "github_pr" ? r.command.ref.number : null;
}

test("the stacked data are the last writes, sent after the whole Silo seed", () => {
  const writes = sent.filter(
    (r) => r === STACKED || (r.method !== "getProject" && r.method !== "listProjects"),
  );
  const last: string[] = writes
    .slice(-(SEED_WRITES + 1))
    .map((r) => (r === STACKED ? r : r.method === "command" ? r.command.method : r.method));
  expect(last).toEqual([
    "setStatus",
    ...SILO_PRS_BRANCHES.map(() => "upsertExternalRef"),
    ...SILO_PRS_NEW.map(() => "upsertExternalRef"),
    STACKED,
    ...SILO_PRS_REFS.filter((s) => !SILO_PRS_NEW.includes(s.number)).map(() => "upsertExternalRef"),
  ]);
  const stackedAt = writes.indexOf(STACKED);
  expect(writes.slice(stackedAt - SILO_PRS_NEW.length, stackedAt).map(prNumberOf)).toEqual([...SILO_PRS_NEW]);
});

test("the fake gh lists the stacked heads only once no branch can discover a pull request", () => {
  if (atStacking === null) throw new Error("the seed never stacked the pull requests");
  const tickets = atStacking.tickets;
  for (const pr of siloPrsGhState({ merged: true })) {
    const owner = tickets.find((t) =>
      t.externalRefs.some((r) => r.kind === "git_branch" && r.branch === pr.head),
    );
    if (owner === undefined) continue;
    expect(owner.externalRefs.some((r) => r.kind === "github_pr" && r.url === pr.url)).toBe(true);
  }
  const rootsBefore = tickets.flatMap((t) =>
    t.externalRefs.flatMap((r) =>
      r.kind === "github_pr" && !SILO_PRS_NEW.includes(r.number) ? [r.base] : [],
    ),
  );
  expect(rootsBefore.every((base) => base === null)).toBe(true);
});

test("SILO-34 starts on its branch and SILO-33 declares its branch on feat/silo-32", () => {
  for (const n of SILO_PRS_IN_PROGRESS) expect(ticket(n).statusId).toBe("in_progress");
  expect(branchOf(33)).toEqual({ kind: "git_branch", branch: "feat/envoi-hors-ligne", base: "feat/silo-32" });
  expect(branchOf(34)).toEqual({ kind: "git_branch", branch: "feat/silo-34", base: "feat/envoi-hors-ligne" });
});

test("five live pull requests carry their base and head, the three of the mockups unchanged otherwise", () => {
  const live = livePrs().sort((a, b) => a.number - b.number);
  expect(live.map((pr) => [pr.number, pr.state, pr.review, pr.checks, pr.base, pr.head])).toEqual([
    [20, "open", "changes_requested", "error", "dev", "feat/silo-45"],
    [22, "open", "none", "ok", "dev", "feat/silo-32"],
    [23, "open", "none", "running", "dev", "chore/expo-54"],
    [24, "draft", "none", "running", "feat/silo-32", "feat/envoi-hors-ligne"],
    [25, "draft", "none", "ok", "feat/envoi-hors-ligne", "feat/silo-34"],
  ]);
  for (const seed of SILO_PRS_REFS)
    expect(
      ticket(seed.n).externalRefs.some((r) => r.kind === "github_pr" && r.url === prUrl(seed.number)),
    ).toBe(true);
});

test("each pull request stands on the one whose head is its base, the roots on the rail", () => {
  const byHead = new Map(livePrs().map((pr) => [pr.head, pr.number]));
  const parentOf = (pr: GithubPrRef) => (pr.base === null ? undefined : byHead.get(pr.base));
  const stacks = livePrs()
    .filter((pr) => parentOf(pr) === undefined)
    .map((root) => {
      const chain = [root.number];
      for (let top = root; ; ) {
        const next = livePrs().find((pr) => parentOf(pr) === top.number);
        if (next === undefined) break;
        chain.push(next.number);
        top = next;
      }
      expect(root.base).toBe(SILO_PRS_RAIL);
      return chain;
    })
    .sort((a, b) => b.length - a.length || (a[0] ?? 0) - (b[0] ?? 0));
  expect(stacks).toEqual(SILO_PRS_STACKS.map((s) => [...s]));
});

test("the fake gh lists the five pull requests with their branches, the merged one kept", () => {
  for (const merged of [false, true]) {
    const state = siloPrsGhState({ merged });
    const plain = siloGhState({ merged });
    expect(state.slice(0, plain.length).map(({ base, head, ...rest }) => rest)).toEqual(plain);
    for (const seed of SILO_PRS_REFS)
      expect(state.find((pr) => pr.number === seed.number)).toMatchObject({
        url: prUrl(seed.number),
        state: "OPEN",
        isDraft: seed.state === "draft",
        base: seed.base,
        head: seed.head,
      });
  }
});

test("a second seed sends nothing again", async () => {
  const before = daemon.writes();
  await seedSiloPrs(daemon.rpc, { ...memorySeed(daemon), stackPrs: () => undefined });
  expect(daemon.writes()).toBe(before);
});
