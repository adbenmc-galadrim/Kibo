import { afterEach, expect, test } from "bun:test";
import type {
  CiRun,
  ExternalRef,
  GithubPrRef,
  ProjectEditRequest,
  ProjectEvent,
  TicketView,
} from "@kibo/schema";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NOW, siloFeatureProject } from "../shell/feature/fixture";
import { type Host, HostProvider } from "../shell/Host";
import { TrackingSection } from "./TrackingSection";

afterEach(cleanup);

const base = siloFeatureProject().tickets.find((t) => t.id === "e33") as TicketView;
const branch: ExternalRef = { kind: "git_branch", branch: "feat/silo-45", base: "dev" };
const pr = (patch: Partial<GithubPrRef> = {}): GithubPrRef => ({
  kind: "github_pr",
  url: "https://github.com/silo-labs/silo-location/pull/20",
  number: 20,
  state: "open",
  base: "dev",
  head: "feat/silo-45",
  review: "changes_requested",
  checks: "ok",
  ...patch,
});
const failing: CiRun = {
  repo: "silo-labs/silo-location",
  runId: 9,
  prNumber: 20,
  ticketKey: "SILO-45",
  headSha: "abc",
  workflow: "CI",
  status: "completed",
  conclusion: "failure",
  url: "https://github.com/silo-labs/silo-location/actions/runs/9",
  startedAt: null,
  updatedAt: "2026-10-16T12:00:00Z",
  jobs: [],
};
const ticket = (patch: Partial<TicketView>): TicketView => ({ ...base, ...patch });
const row = (name: string) => {
  const term = within(screen.getByRole("region", { name: /^Suivi/ }))
    .getAllByRole("term")
    .find((t) => t.textContent === name);
  return term?.nextElementSibling ?? null;
};
const words = (name: string) =>
  Array.from(row(name)?.querySelectorAll("span, a") ?? [])
    .filter((el) => Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent))
    .map((el) => el.textContent);
const at = (h: number, m: number) => new Date(2026, 9, 16, h, m).getTime();
const event = (kind: ProjectEvent["kind"], when: number, data: ProjectEvent["data"]): ProjectEvent => ({
  id: when,
  projectId: "silo",
  kind,
  ticketId: "e33",
  featureId: "f5",
  source: "git",
  data,
  at: when,
});

test("the Suivi block names the branch, the PR, its review, the CI, the session and the step, with their times", () => {
  render(
    <TrackingSection
      ticket={ticket({
        externalRefs: [branch, pr()],
        session: { tool: "T3 Code", startedAt: NOW - 42 * 60_000 },
        delivery: { step: 9, note: "", at: NOW, runId: null, kind: "delivery" },
      })}
      ciRuns={[
        {
          ...failing,
          updatedAt: new Date(at(11, 58)).toISOString(),
          jobs: [
            {
              jobId: 1,
              name: "e2e",
              status: "completed",
              conclusion: "failure",
              startedAt: null,
              completedAt: null,
            },
          ],
        },
      ]}
      events={[
        event("pr_opened", NOW - 22 * 3_600_000, { number: 20 }),
        event("pr_review", at(13, 47), { number: 20, review: "changes_requested" }),
      ]}
      now={NOW}
    />,
  );
  expect(screen.getByText("remonté de git, des PR et de full-delivery")).toBeTruthy();
  expect(words("Branche")).toEqual(["feat/silo-45", "sur", "dev"]);
  expect(words("PR")).toEqual(["#20", "ouverte hier à 16:52"]);
  expect(words("Review")).toEqual(["changements demandés", "13:47"]);
  expect(words("CI")).toEqual(["CI cassée", "job e2e · 11:58"]);
  expect(
    within(row("CI") as HTMLElement)
      .getByRole("link")
      .getAttribute("href"),
  ).toBe("https://github.com/silo-labs/silo-location/actions/runs/9/job/1");
  expect(row("Session")?.textContent).toBe("T3 Code · 42 min");
  expect(words("Livraison")).toEqual(["Étape 9/12 · Review", "· suivante : Démo"]);
});

test("the CI row reads the checks of the PR when no run is known, and says « Pas de CI » without any", () => {
  const view = render(
    <TrackingSection
      ticket={ticket({ externalRefs: [pr({ checks: "running" })] })}
      ciRuns={[]}
      events={[]}
      now={NOW}
    />,
  );
  expect(words("CI")[0]).toBe("CI en cours");
  view.unmount();
  const broken = render(
    <TrackingSection
      ticket={ticket({ externalRefs: [pr({ checks: "error" })] })}
      ciRuns={[]}
      events={[]}
      now={NOW}
    />,
  );
  expect(
    within(row("CI") as HTMLElement)
      .getByRole("link")
      .getAttribute("href"),
  ).toBe("https://github.com/silo-labs/silo-location/pull/20/checks");
  expect(words("CI")).toEqual(["CI cassée", "voir les checks"]);
  broken.unmount();
  render(
    <TrackingSection
      ticket={ticket({ externalRefs: [pr({ checks: null })] })}
      ciRuns={[]}
      events={[]}
      now={NOW}
    />,
  );
  expect(row("CI")?.textContent).toBe("Pas de CI");
});

test("a retouch names its phase « Retouche · Étape 7/12 · Porte qualité »", () => {
  render(
    <TrackingSection
      ticket={ticket({
        externalRefs: [branch],
        delivery: { step: 7, note: "", at: NOW, runId: null, kind: "update" },
      })}
      ciRuns={[]}
      events={[]}
      now={NOW}
    />,
  );
  expect(words("Livraison")[0]).toBe("Retouche · Étape 7/12 · Porte qualité");
});

test("a ticket without any tracking says how to declare its branch", () => {
  render(
    <TrackingSection
      ticket={ticket({ externalRefs: [], session: null, delivery: null })}
      ciRuns={[]}
      events={[]}
      now={NOW}
    />,
  );
  expect(screen.getByText("Aucun suivi git : déclare la branche avec kibo tickets set")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copier kibo tickets set SILO-33 branch=" })).toBeTruthy();
});

test("a declared branch is marked « déclarée »", () => {
  render(
    <TrackingSection
      ticket={ticket({ externalRefs: [{ kind: "git_branch", branch: "feat/x", base: null }] })}
      ciRuns={[]}
      events={[event("branch_created", at(14, 12), { branch: "feat/x", declared: true })]}
      now={NOW}
    />,
  );
  expect(words("Branche")).toEqual(["feat/x", "déclarée"]);
});

test("a pushed branch is not marked « déclarée »", () => {
  render(
    <TrackingSection
      ticket={ticket({ externalRefs: [{ kind: "git_branch", branch: "feat/x", base: null }] })}
      ciRuns={[]}
      events={[
        event("branch_created", at(14, 12), { branch: "feat/x", declared: true }),
        event("branch_created", at(14, 20), { branch: "feat/x" }),
      ]}
      now={NOW}
    />,
  );
  expect(words("Branche")).toEqual(["feat/x"]);
});

test("a ticket of a project without repository offers to choose the folder, the CLI as a secondary link", async () => {
  const edits: ProjectEditRequest[] = [];
  const none = () => undefined;
  const host: Host = {
    openTicket: none,
    openNewTicket: none,
    openFile: none,
    openView: none,
    openTarget: none,
    editProject: (r) => void edits.push(r),
  };
  render(
    <HostProvider host={host}>
      <TrackingSection
        ticket={ticket({ externalRefs: [], session: null, delivery: null })}
        ciRuns={[]}
        events={[]}
        now={NOW}
        repo={false}
      />
    </HostProvider>,
  );
  expect(screen.getByText("Relie le dépôt pour suivre la branche")).toBeTruthy();
  expect(screen.queryByText("Aucun suivi git : déclare la branche avec kibo tickets set")).toBeNull();
  await userEvent.setup().click(screen.getByRole("button", { name: "Choisir le dossier" }));
  expect(edits).toEqual([{ field: "folder" }]);
  expect(screen.getByRole("button", { name: "Copier kibo tickets set SILO-33 branch=" })).toBeTruthy();
});

test("without a CI run the CI row names the failing check of the PR, linked to its checks page", () => {
  render(
    <TrackingSection
      ticket={ticket({ externalRefs: [pr({ checks: "error", failedCheck: "lint" })] })}
      ciRuns={[]}
      events={[]}
      now={NOW}
    />,
  );
  expect(words("CI")).toEqual(["CI cassée", "job lint"]);
  expect(
    within(row("CI") as HTMLElement)
      .getByRole("link")
      .getAttribute("href"),
  ).toBe("https://github.com/silo-labs/silo-location/pull/20/checks");
});

test("a merged PR shows no review row for its stale changes requested", () => {
  render(
    <TrackingSection
      ticket={ticket({ externalRefs: [branch, pr({ state: "merged" })] })}
      ciRuns={[]}
      events={[]}
      now={NOW}
    />,
  );
  expect(words("PR")[0]).toBe("#20");
  expect(row("Review")).toBeNull();
});
