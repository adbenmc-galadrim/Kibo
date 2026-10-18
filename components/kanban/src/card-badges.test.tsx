import { afterEach, expect, test } from "bun:test";
import { type CiRun, EMPTY_PROGRESS, type GithubPrRef, type TicketView } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import { BlockedBadge, CardBadges } from "./CardBadges";
import { cardTitle } from "./card-title";

afterEach(cleanup);

const pr = (over: Partial<GithubPrRef> = {}): GithubPrRef => ({
  kind: "github_pr",
  url: "https://github.com/galadrim/emis/pull/20",
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
  key: "EMIS-45",
  pendingSeq: null,
  keyLabel: "EMIS-45",
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
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
  effectiveSprintId: null,
  session: null,
  updatedAt: null,
  feature: null,
  ...over,
});

const run = (conclusion: string | null): CiRun => ({
  repo: "galadrim/emis",
  runId: 1,
  prNumber: 20,
  ticketKey: "EMIS-45",
  headSha: "abc",
  workflow: "CI",
  status: conclusion === null ? "in_progress" : "completed",
  conclusion,
  url: "https://github.com/galadrim/emis/actions/runs/1",
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
  const branch = { kind: "git_branch" as const, branch: "feat/emis-53", base: null };
  render(<CardBadges ticket={{ externalRefs: [branch] }} ciRuns={[]} />);
  expect(screen.getByLabelText("Branche feat/emis-53").textContent).toBe("feat/emis-53");
  cleanup();
  render(<CardBadges ticket={{ externalRefs: [branch, pr()] }} ciRuns={[]} />);
  expect(screen.queryByLabelText("Branche feat/emis-53")).toBeNull();
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

test("a 'Démo client' step is titled after its feature, other titles stay", () => {
  const group = { id: "f", keyLabel: "EMIS-3", title: "Import", shortKey: "F6" };
  expect(cardTitle(ticket([], { title: "Démo client" }), group)).toBe("Démo · F6");
  expect(cardTitle(ticket([], { title: " démo client " }), group)).toBe("Démo · F6");
  expect(cardTitle(ticket([], { title: "Démo client" }), { ...group, shortKey: null })).toBe("Démo · EMIS-3");
  expect(cardTitle(ticket([], { title: "Démo client" }), null)).toBe("Démo client");
  expect(cardTitle(ticket([], { title: "Écran d'import" }), group)).toBe("Écran d'import");
});
