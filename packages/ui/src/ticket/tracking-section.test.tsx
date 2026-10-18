import { afterEach, expect, test } from "bun:test";
import type { CiRun, ExternalRef, GithubPrRef, TicketView } from "@kibo/schema";
import { cleanup, render, screen, within } from "@testing-library/react";
import { emisFeatureProject, NOW } from "../shell/feature/fixture";
import { TrackingSection } from "./TrackingSection";

afterEach(cleanup);

const base = emisFeatureProject().tickets.find((t) => t.id === "e33") as TicketView;
const branch: ExternalRef = { kind: "git_branch", branch: "feat/emis-45", base: "dev" };
const pr = (patch: Partial<GithubPrRef> = {}): GithubPrRef => ({
  kind: "github_pr",
  url: "https://github.com/galadrim/emis/pull/20",
  number: 20,
  state: "open",
  base: "dev",
  head: "feat/emis-45",
  review: "changes_requested",
  checks: "ok",
  ...patch,
});
const failing: CiRun = {
  repo: "galadrim/emis",
  runId: 9,
  prNumber: 20,
  ticketKey: "EMIS-45",
  headSha: "abc",
  workflow: "CI",
  status: "completed",
  conclusion: "failure",
  url: "https://github.com/galadrim/emis/actions/runs/9",
  startedAt: null,
  updatedAt: "2026-10-16T12:00:00Z",
  jobs: [],
};
const ticket = (patch: Partial<TicketView>): TicketView => ({ ...base, ...patch });
const row = (name: string) =>
  within(screen.getByRole("region", { name: "Suivi" }))
    .getAllByRole("term")
    .find((term) => term.textContent === name)?.nextElementSibling?.textContent;

test("the Suivi block names the branch, the PR and its review, the CI, the session and the step", () => {
  render(
    <TrackingSection
      ticket={ticket({
        externalRefs: [branch, pr()],
        session: { tool: "T3 Code", startedAt: NOW - 42 * 60_000 },
        delivery: { step: 7, note: "", at: NOW, runId: null, kind: "delivery" },
      })}
      ciRuns={[failing]}
      now={NOW}
    />,
  );
  expect(row("Branche")).toBe("feat/emis-45 sur dev");
  expect(row("PR")).toBe("#20 · ouverte · changements demandés");
  expect(row("CI")).toContain("CI cassée");
  expect(row("Session")).toBe("T3 Code · 42 min");
  expect(row("Étape")).toBe("7 · Porte qualité");
});

test("the CI row falls back to the checks of the PR when no run is known", () => {
  render(
    <TrackingSection ticket={ticket({ externalRefs: [pr({ checks: "running" })] })} ciRuns={[]} now={NOW} />,
  );
  expect(row("CI")).toBe("CI en cours");
});

test("a retouch names its step « Retouche · 7 · Porte qualité »", () => {
  render(
    <TrackingSection
      ticket={ticket({
        externalRefs: [branch],
        delivery: { step: 7, note: "", at: NOW, runId: null, kind: "update" },
      })}
      ciRuns={[]}
      now={NOW}
    />,
  );
  expect(row("Étape")).toBe("Retouche · 7 · Porte qualité");
});

test("a ticket without any tracking says how to declare its branch", () => {
  render(
    <TrackingSection
      ticket={ticket({ externalRefs: [], session: null, delivery: null })}
      ciRuns={[]}
      now={NOW}
    />,
  );
  expect(screen.getByText("Aucun suivi git : déclare la branche avec kibo tickets set")).toBeTruthy();
});
