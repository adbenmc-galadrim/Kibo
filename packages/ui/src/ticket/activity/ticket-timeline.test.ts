import { expect, test } from "bun:test";
import { type CiRun, DEFAULT_WORKFLOW, type ProjectEvent } from "@kibo/schema";
import { NOW } from "../../shell/feature/fixture";
import { ticketTimeline } from "./ticket-timeline";

const at = (day: number, h: number, m: number) => new Date(2026, 9, day, h, m).getTime();
let seq = 0;
const ev = (
  kind: ProjectEvent["kind"],
  when: number,
  data: ProjectEvent["data"] = {},
  source: ProjectEvent["source"] = "git",
): ProjectEvent => ({
  id: ++seq,
  projectId: "emis",
  kind,
  ticketId: "e33",
  featureId: "f5",
  source,
  data,
  at: when,
});
const project = { workflow: DEFAULT_WORKFLOW };

test("the journal of a ticket reads as dated lines, newest first, the status riding on its cause", () => {
  const lines = ticketTimeline(
    [
      ev("branch_created", at(14, 9, 5), { branch: "feat/envoi-hors-ligne" }),
      ev("status_changed", at(14, 9, 5), { from: "todo", to: "in_progress" }),
      ev("session_started", at(16, 14, 10), { tool: "T3 Code" }, "full-delivery"),
      ev("step_set", at(16, 14, 51), { step: 7, note: "" }, "full-delivery"),
      ev("pr_opened", at(16, 15, 0), { number: 20 }),
      ev("status_changed", at(16, 15, 0), { from: "in_progress", to: "in_review" }),
      ev("status_changed", at(15, 10, 0), { from: "in_review", to: "in_progress" }),
    ],
    project,
    NOW,
  );
  expect(lines.map((l) => [l.kind, l.text, l.time, l.aside?.text ?? null])).toEqual([
    ["pr", "PR #20 ouverte", "15:00", "statut ⇒ En review"],
    ["step", "Étape 7 · Porte qualité", "14:51", null],
    ["session", "Session T3 Code ouverte", "14:10", null],
    ["status", "Passé en En cours", "hier 10:00", null],
    ["branch", "Branche feat/envoi-hors-ligne poussée", "14 oct. 09:05", "statut ⇒ En cours"],
  ]);
});

test("reviews, checks, merges, retouches and sprints get their own words", () => {
  const texts = ticketTimeline(
    [
      ev("pr_review", at(16, 9, 0), { number: 20, review: "changes_requested" }),
      ev("pr_checks", at(16, 9, 1), { number: 20, checks: "error" }),
      ev("pr_merged", at(16, 9, 2), { number: 20 }),
      ev("step_set", at(16, 9, 3), { step: 7, kind: "update" }, "update-delivery"),
      ev("sprint_set", at(16, 9, 4), { from: null, to: "S42" }, "user"),
      ev("session_stopped", at(16, 9, 5), { tool: "T3 Code" }),
    ],
    project,
    NOW,
  ).map((l) => l.text);
  expect(texts).toEqual([
    "Session T3 Code fermée",
    "Planifié en S42",
    "Retouche · 7 · Porte qualité",
    "PR #20 fusionnée",
    "CI cassée sur PR #20",
    "Changements demandés sur PR #20",
  ]);
});

test("a broken CI names its failed job and links to the log", () => {
  const run: CiRun = {
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
  };
  const [line] = ticketTimeline(
    [ev("pr_checks", at(16, 11, 58), { number: 20, checks: "error" })],
    project,
    NOW,
    [run],
  );
  expect(line?.aside).toEqual({ text: "job e2e · ", link: { label: "voir le journal", url: run.url } });
});

test("missing or odd data degrades to a plain line, never an error", () => {
  const texts = ticketTimeline(
    [
      ev("pr_opened", at(16, 8, 0), {}),
      ev("branch_created", at(16, 8, 1), { branch: 3 }),
      ev("status_changed", at(16, 8, 10), { to: "nowhere" }),
      ev("step_set", at(16, 8, 13), { step: "x" }),
      ev("session_started", at(16, 8, 14), {}),
      ev("batch_proposed", at(16, 8, 15), { seq: 2 }, "project-agent"),
    ],
    project,
    NOW,
  ).map((l) => l.text);
  expect(texts).toEqual([
    "Mise à jour du suivi",
    "Session ouverte",
    "Étape mise à jour",
    "Passé en nowhere",
    "Branche poussée",
    "PR ouverte",
  ]);
});
