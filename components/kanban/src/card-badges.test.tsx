import { afterEach, expect, test } from "bun:test";
import { type CiRun, EMPTY_PROGRESS, type GithubPrRef, type TicketView } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import { BlockedBadge, CardBadges, HeldBadge } from "./CardBadges";

afterEach(cleanup);

const pr = (over: Partial<GithubPrRef> = {}): GithubPrRef => ({
  kind: "github_pr",
  url: "https://github.com/silo-labs/silo-location/pull/20",
  number: 20,
  state: "open",
  base: null,
  head: null,
  review: "none",
  checks: null,
  ...over,
});

const ticket = (refs: GithubPrRef[], over: Partial<TicketView> = {}): TicketView => ({
  id: "1@1",
  key: "SILO-45",
  hold: null,
  keyLabel: "SILO-45",
  title: "Conflits de saisie",
  description: "",
  statusId: "in_review",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  labels: [],
  externalRefs: refs,
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
  startable: false,
  startReason: null,
  onHold: null,
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
  effectiveSprintId: null,
  session: null,
  thread: null,
  updatedAt: null,
  feature: null,
  ...over,
});

const run = (conclusion: string | null): CiRun => ({
  repo: "silo-labs/silo-location",
  runId: 1,
  prNumber: 20,
  ticketKey: "SILO-45",
  headSha: "abc",
  workflow: "CI",
  status: conclusion === null ? "in_progress" : "completed",
  conclusion,
  url: "https://github.com/silo-labs/silo-location/actions/runs/1",
  startedAt: null,
  updatedAt: "2026-10-16T10:00:00Z",
  jobs: [],
});

const badges = (t: TicketView, runs: CiRun[] = []) => render(<CardBadges ticket={t} ciRuns={runs} />);

test("a PR with changes requested and a broken CI shows its number, the review and the CI", () => {
  badges(ticket([pr({ review: "changes_requested", checks: "error" })]));
  expect(screen.getByText("#20")).toBeTruthy();
  const changes = screen.getByLabelText("changements demandés");
  expect(changes.getAttribute("title")).toBe("changements demandés");
  expect(changes.className).toContain("whitespace-nowrap");
  const [long, short] = Array.from(changes.children);
  expect(long?.textContent).toBe("changements demandés");
  expect(long?.className).toContain("@max-[144px]/card:hidden");
  expect(short?.textContent).toBe("changements");
  expect(short?.className).toContain("@max-[144px]/card:inline");
  expect(screen.getByLabelText("CI cassée").closest("[data-ci]")?.textContent).toBe("CI cassée");
});

test("the CI badge reads green, red or running from the PR runs first", () => {
  badges(ticket([pr({ checks: "error" })]), [run("success")]);
  expect(screen.getByLabelText("CI réussie").closest("[data-ci]")?.textContent).toBe("CI");
  cleanup();
  badges(ticket([pr({ checks: "ok" })]), [run(null)]);
  expect(screen.getByLabelText("CI en cours").closest("[data-ci]")?.textContent).toBe("CI en cours");
  cleanup();
  badges(ticket([pr({ checks: "ok" })]), [run("failure")]);
  expect(screen.getByLabelText("CI cassée")).toBeTruthy();
});

test("an approved PR shows no review badge, a merged PR no review either", () => {
  badges(ticket([pr({ review: "approved" })]));
  expect(screen.queryByLabelText("changements demandés")).toBeNull();
  cleanup();
  badges(ticket([pr({ state: "merged", review: "changes_requested" })]));
  expect(screen.getByText("#20").closest("[data-pr]")?.getAttribute("data-pr")).toBe("merged");
  expect(screen.queryByLabelText("changements demandés")).toBeNull();
});

test("no PR and no CI run: no badge at all", () => {
  const { container } = badges(ticket([]));
  expect(container.textContent).toBe("");
});

test("a branch without a PR shows the branch; once a PR exists, only the PR", () => {
  const branch = { kind: "git_branch" as const, branch: "feat/silo-53", base: null };
  render(<CardBadges ticket={{ externalRefs: [branch] }} ciRuns={[]} />);
  expect(screen.getByLabelText("Branche feat/silo-53").textContent).toBe("feat/silo-53");
  cleanup();
  render(<CardBadges ticket={{ externalRefs: [branch, pr()] }} ciRuns={[]} />);
  expect(screen.queryByLabelText("Branche feat/silo-53")).toBeNull();
  expect(screen.getByText("#20")).toBeTruthy();
});

test("a CI run without a PR still shows the CI and the PR number it carries", () => {
  badges(ticket([]), [{ ...run("failure"), prNumber: 12 }]);
  expect(screen.getByText("#12")).toBeTruthy();
  expect(screen.getByLabelText("CI cassée")).toBeTruthy();
});

test("the blocked badge names the blocking question, or just says blocked", () => {
  render(
    <BlockedBadge question={{ number: 3, importRef: { kind: "import_ref", source: "plan", id: "Q14" } }} />,
  );
  expect(screen.getByText("bloqué · Q14")).toBeTruthy();
  cleanup();
  render(<BlockedBadge question={{ number: 7, importRef: null }} />);
  expect(screen.getByText("bloqué · Q7")).toBeTruthy();
  cleanup();
  render(<BlockedBadge question={null} />);
  expect(screen.getByText("bloqué")).toBeTruthy();
});

test("the hold chip is full cyan like the blocked one, its label and text unchanged", () => {
  render(
    <HeldBadge
      hold={{
        source: "own",
        key: "SILO-33",
        reason: "Serveur MinIO de recette indisponible",
        since: "2026-10-16",
      }}
    />,
  );
  const badge = screen.getByRole("note", { name: "En attente : Serveur MinIO de recette indisponible" });
  expect(badge.textContent).toBe("Serveur MinIO de recette…");
  expect(badge.className).toContain("bg-(--tracking-hold-soft) text-(--tracking-hold)");
  expect(badge.className).not.toContain("border-dashed");
});

const greenRun = (): CiRun => run("success");

test("a card with requested changes shows the amber badge and a neutral PR chip, no CI chip", () => {
  const { container } = render(
    <CardBadges ticket={ticket([pr({ review: "changes_requested" })])} ciRuns={[greenRun()]} />,
  );
  expect(screen.getByRole("note", { name: "changements demandés" })).toBeTruthy();
  const chip = container.querySelector("[data-pr]");
  expect(chip?.textContent).toBe("#20");
  expect(chip?.querySelector("svg")?.getAttribute("class")).not.toContain("tracking-purple");
  expect(container.querySelector("[data-ci]")).toBeNull();
});

test("a signal elsewhere on the card quiets the PR chip and the green CI", () => {
  const { container } = render(<CardBadges ticket={ticket([pr()])} ciRuns={[greenRun()]} signaled />);
  expect(container.querySelector("[data-pr] svg")?.getAttribute("class")).not.toContain("tracking-purple");
  expect(container.querySelector("[data-ci]")).toBeNull();
});

test("a broken CI stays visible beside another signal", () => {
  const { container } = render(<CardBadges ticket={ticket([pr()])} ciRuns={[run("failure")]} signaled />);
  expect(container.querySelector("[data-ci='error']")).toBeTruthy();
});

test("without a signal the PR keeps its colour", () => {
  const { container } = render(<CardBadges ticket={ticket([pr()])} ciRuns={[greenRun()]} />);
  expect(container.querySelector("[data-pr] svg")?.getAttribute("class")).toContain("tracking-purple");
  expect(container.querySelector("[data-ci='ok']")).toBeTruthy();
});
