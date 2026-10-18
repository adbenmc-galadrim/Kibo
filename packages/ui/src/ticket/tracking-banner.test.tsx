import { afterEach, expect, test } from "bun:test";
import type { CiRun, GithubPrRef, TicketView } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import { emisFeatureProject } from "../shell/feature/fixture";
import { TrackingBanner } from "./TrackingBanner";

afterEach(cleanup);

const e45 = emisFeatureProject().tickets.find((t) => t.id === "e33") as TicketView;
const PR_URL = "https://github.com/galadrim/emis/pull/20";
const pr = (patch: Partial<GithubPrRef> = {}): GithubPrRef => ({
  kind: "github_pr",
  url: PR_URL,
  number: 20,
  state: "open",
  base: "dev",
  head: "feat/emis-45",
  review: "none",
  checks: null,
  ...patch,
});
const ticket = (ref: GithubPrRef): TicketView => ({
  ...e45,
  key: "EMIS-45",
  keyLabel: "EMIS-45",
  externalRefs: [ref],
});
const run = (patch: Partial<CiRun>): CiRun => ({
  repo: "galadrim/emis",
  runId: 7,
  prNumber: 20,
  ticketKey: "EMIS-45",
  headSha: "abc",
  workflow: "CI",
  status: "completed",
  conclusion: "failure",
  url: "https://github.com/galadrim/emis/actions/runs/7",
  startedAt: null,
  updatedAt: "2026-10-16T12:00:00Z",
  jobs: [],
  ...patch,
});

test("changes requested and a broken CI make one banner with links to the PR and to the job", () => {
  render(<TrackingBanner ticket={ticket(pr({ review: "changes_requested" }))} ciRuns={[run({})]} />);
  const banner = screen.getByRole("status");
  expect(banner.textContent).toContain("PR #20 · changements demandés · CI cassée");
  expect(screen.getByRole("link", { name: /PR #20/ }).getAttribute("href")).toBe(PR_URL);
  expect(screen.getByRole("link", { name: "Voir le job" }).getAttribute("href")).toBe(
    "https://github.com/galadrim/emis/actions/runs/7",
  );
});

test("without a CI run the banner reads the checks of the PR and offers no job link", () => {
  render(
    <TrackingBanner ticket={ticket(pr({ review: "changes_requested", checks: "error" }))} ciRuns={[]} />,
  );
  expect(screen.getByRole("status").textContent).toContain("PR #20 · changements demandés · CI cassée");
  expect(screen.queryByRole("link", { name: "Voir le job" })).toBeNull();
});

test("an open PR with nothing to fix shows no banner", () => {
  const { container } = render(<TrackingBanner ticket={ticket(pr({ checks: "ok" }))} ciRuns={[]} />);
  expect(container.textContent).toBe("");
  render(
    <TrackingBanner ticket={ticket(pr({ review: "changes_requested", state: "merged" }))} ciRuns={[]} />,
  );
  expect(screen.queryByRole("status")).toBeNull();
});

test("a running CI is announced as « CI en cours »", () => {
  render(
    <TrackingBanner ticket={ticket(pr())} ciRuns={[run({ status: "in_progress", conclusion: null })]} />,
  );
  expect(screen.getByRole("status").textContent).toContain("PR #20 · CI en cours");
});
