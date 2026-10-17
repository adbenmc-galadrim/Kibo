import { expect, test } from "bun:test";
import type { ExternalRef } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import { GitPrCell } from "./GitPrCell";

const pr = (number: number, state: "open" | "draft" | "merged" | "closed"): ExternalRef => ({
  kind: "github_pr",
  url: `https://github.com/galadrim/emis/pull/${number}`,
  number,
  state,
  base: "main",
  head: null,
});
const branch: ExternalRef = { kind: "git_branch", branch: "feat/envoi-hors-ligne", base: null };
const cell = (refs: ExternalRef[], waitingOn: string[] = [], ci: "ok" | "error" | null = null) =>
  render(<GitPrCell ticket={{ externalRefs: refs, waitingOn }} ci={ci} />).container;

test("a branch alone shows its name next to the branch icon", () => {
  const c = cell([branch]);
  expect(c.textContent).toBe("feat/envoi-hors-ligne");
  expect(c.querySelector(".lucide-git-branch")).toBeTruthy();
});

test("a PR wins over the branch and carries its CI: green check when it passes", () => {
  const c = cell([branch, pr(22, "open")], [], "ok");
  expect(c.textContent).toBe("#22");
  expect(c.querySelector(".lucide-git-pull-request")).toBeTruthy();
  expect(screen.getByRole("img", { name: "CI réussie" })).toBeTruthy();
});

test("a merged PR reads fusionnée with the merge icon; the latest PR is the one shown", () => {
  const c = cell([pr(12, "closed"), pr(18, "merged")], [], "error");
  expect(c.textContent).toBe("#18fusionnée");
  expect(c.querySelector(".lucide-git-merge")).toBeTruthy();
  expect(screen.getByRole("img", { name: "CI cassée" })).toBeTruthy();
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
