import { afterEach, expect, test } from "bun:test";
import type { CiRun, GithubPrRef, TicketView } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import { siloFeatureProject } from "../shell/feature/fixture";
import { TrackingBanner } from "./TrackingBanner";

afterEach(cleanup);

const e45 = siloFeatureProject().tickets.find((t) => t.id === "e33") as TicketView;
const PR_URL = "https://github.com/silo-labs/silo-location/pull/20";
const pr = (patch: Partial<GithubPrRef> = {}): GithubPrRef => ({
  kind: "github_pr",
  url: PR_URL,
  number: 20,
  state: "open",
  base: "dev",
  head: "feat/silo-45",
  review: "none",
  checks: null,
  ...patch,
});
const ticket = (ref: GithubPrRef): TicketView => ({
  ...e45,
  key: "SILO-45",
  keyLabel: "SILO-45",
  externalRefs: [ref],
});
const run = (patch: Partial<CiRun>): CiRun => ({
  repo: "silo-labs/silo-location",
  runId: 7,
  prNumber: 20,
  ticketKey: "SILO-45",
  headSha: "abc",
  workflow: "CI",
  status: "completed",
  conclusion: "failure",
  url: "https://github.com/silo-labs/silo-location/actions/runs/7",
  startedAt: null,
  updatedAt: "2026-10-16T12:00:00Z",
  jobs: [],
  ...patch,
});

test("changes requested and a broken CI make one banner with links to the PR and to the job", () => {
  render(<TrackingBanner ticket={ticket(pr({ review: "changes_requested" }))} ciRuns={[run({})]} />);
  const banner = screen.getByRole("status");
  expect(banner.textContent).toContain("PR #20 · changements demandés · CI cassée");
  expect(banner.className).toContain("amber");
  expect(screen.getByRole("link", { name: "PR" }).getAttribute("href")).toBe(PR_URL);
  expect(screen.getByRole("link", { name: "Job" }).getAttribute("href")).toBe(
    "https://github.com/silo-labs/silo-location/actions/runs/7",
  );
});

test("without a CI run the banner reads the checks of the PR and links to its checks page", () => {
  render(
    <TrackingBanner ticket={ticket(pr({ review: "changes_requested", checks: "error" }))} ciRuns={[]} />,
  );
  expect(screen.getByRole("status").textContent).toContain("PR #20 · changements demandés · CI cassée");
  expect(screen.getByRole("link", { name: "Job" }).getAttribute("href")).toBe(`${PR_URL}/checks`);
});

test("an open PR with nothing to fix shows no banner", () => {
  const { container } = render(<TrackingBanner ticket={ticket(pr({ checks: "ok" }))} ciRuns={[]} />);
  expect(container.textContent).toBe("");
  render(
    <TrackingBanner ticket={ticket(pr({ review: "changes_requested", state: "merged" }))} ciRuns={[]} />,
  );
  expect(screen.queryByRole("status")).toBeNull();
});

test("a broken CI alone makes a red banner", () => {
  render(<TrackingBanner ticket={ticket(pr({ checks: "error" }))} ciRuns={[]} />);
  const banner = screen.getByRole("status");
  expect(banner.textContent).toContain("PR #20 · CI cassée");
  expect(banner.className).toContain("red");
});

test("a running CI is announced as « CI en cours »", () => {
  render(
    <TrackingBanner ticket={ticket(pr())} ciRuns={[run({ status: "in_progress", conclusion: null })]} />,
  );
  expect(screen.getByRole("status").textContent).toContain("PR #20 · CI en cours");
});

test("the job link of a broken CI names the failed job and points to it", () => {
  const job = {
    jobId: 4,
    name: "lint",
    status: "completed",
    conclusion: "failure",
    startedAt: null,
    completedAt: null,
  };
  render(<TrackingBanner ticket={ticket(pr({ checks: "error" }))} ciRuns={[run({ jobs: [job] })]} />);
  expect(screen.getByRole("link", { name: "Job lint" }).getAttribute("href")).toBe(
    "https://github.com/silo-labs/silo-location/actions/runs/7/job/4",
  );
});

test("without a CI run the job link names the failing check of the PR and opens its checks page", () => {
  render(<TrackingBanner ticket={ticket(pr({ checks: "error", failedCheck: "lint" }))} ciRuns={[]} />);
  expect(screen.getByRole("link", { name: "Job lint" }).getAttribute("href")).toBe(`${PR_URL}/checks`);
});
