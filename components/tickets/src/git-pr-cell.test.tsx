import { expect, test } from "bun:test";
import type { CiRun, ExternalRef, PrChecks, PrReview } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import { GitPrCell } from "./GitPrCell";

type PrPatch = { review?: PrReview; checks?: PrChecks | null };

const pr = (
  number: number,
  state: "open" | "draft" | "merged" | "closed",
  patch: PrPatch = {},
): ExternalRef => ({
  kind: "github_pr",
  url: `https://github.com/galadrim/emis/pull/${number}`,
  number,
  state,
  base: "main",
  head: null,
  review: patch.review ?? "none",
  checks: patch.checks ?? null,
});
const ciRun = (prNumber: number, conclusion: string): CiRun => ({
  repo: "galadrim/emis",
  runId: prNumber * 10,
  prNumber,
  ticketKey: "EMIS-45",
  headSha: "abc",
  workflow: "ci",
  status: "completed",
  conclusion,
  url: "https://github.com/galadrim/emis/actions/runs/1",
  startedAt: null,
  updatedAt: "2026-10-16T12:00:00Z",
  jobs: [],
});
const branch: ExternalRef = { kind: "git_branch", branch: "feat/envoi-hors-ligne", base: null };
const cell = (refs: ExternalRef[], waitingOn: string[] = [], runs: CiRun[] = []) =>
  render(<GitPrCell ticket={{ externalRefs: refs, waitingOn }} runs={runs} />).container;

test("a branch alone shows its name next to the branch icon", () => {
  const c = cell([branch]);
  expect(c.textContent).toBe("feat/envoi-hors-ligne");
  expect(c.querySelector(".lucide-git-branch")).toBeTruthy();
});

test("a PR wins over the branch; its checks give the green mark without any CI run", () => {
  const c = cell([branch, pr(22, "open", { checks: "ok" })]);
  expect(c.textContent).toBe("#22");
  expect(c.querySelector(".lucide-git-pull-request")).toBeTruthy();
  expect(screen.getByRole("img", { name: "CI réussie" })).toBeTruthy();
});

test("changes requested read in orange, the failing checks give the red mark", () => {
  const c = cell([pr(20, "open", { review: "changes_requested", checks: "error" })]);
  expect(c.textContent).toBe("#20changements demandés");
  expect(screen.getByText("changements demandés").className).toContain("text-(--tracking-brand-text)");
  expect(screen.getByRole("img", { name: "CI cassée" })).toBeTruthy();
});

test("an approved PR says so in green; review_required shows nothing", () => {
  cell([pr(24, "open", { review: "approved" })]);
  expect(screen.getByText("approuvée").className).toContain("text-(--tracking-green)");
  expect(cell([pr(25, "open", { review: "review_required" })]).textContent).toBe("#25");
});

test("the CI runs of the PR win over its checks", () => {
  cell([pr(22, "open", { checks: "ok" })], [], [ciRun(22, "failure"), ciRun(30, "success")]);
  expect(screen.getByRole("img", { name: "CI cassée" })).toBeTruthy();
});

test("a merged PR reads fusionnée with the merge icon; the latest PR is the one shown", () => {
  const c = cell([pr(12, "closed"), pr(18, "merged", { checks: "ok" })]);
  expect(c.textContent).toBe("#18fusionnée");
  expect(c.querySelector(".lucide-git-merge")).toBeTruthy();
  expect(screen.getByRole("img", { name: "CI réussie" })).toBeTruthy();
});

test("a draft PR says so, without CI it shows no mark", () => {
  const c = cell([pr(23, "draft")]);
  expect(c.textContent).toBe("#23brouillon");
  expect(screen.queryByRole("img")).toBeNull();
});

test("without branch nor PR: what it waits on, else a dash", () => {
  expect(cell([], ["KIB-14"]).textContent).toBe("attend KIB-14");
  expect(cell([]).textContent).toBe("—");
});
