import { expect, test } from "bun:test";
import type { ProjectEvent } from "@kibo/schema";
import { journalActivity } from "./feature-feed";
import { NOW, siloFeatureProject } from "./fixture";

const project = siloFeatureProject();
let id = 0;
const event = (patch: Partial<ProjectEvent> & Pick<ProjectEvent, "kind">): ProjectEvent => ({
  id: ++id,
  projectId: "silo",
  at: NOW - 60_000,
  ticketId: null,
  featureId: "f5",
  source: "git",
  data: {},
  ...patch,
});

test("the journal gives the activity lines, with the key of the step", () => {
  const items = journalActivity(
    [
      event({
        kind: "pr_opened",
        ticketId: "e32",
        data: { number: 22 },
        at: new Date(2026, 9, 16, 15, 4).getTime(),
      }),
      event({ kind: "step_set", ticketId: "e33", source: "full-delivery", data: { step: 7 } }),
      event({ kind: "batch_proposed", source: "project-agent", data: { seq: 7 } }),
      event({ kind: "pr_merged", ticketId: "e31", data: { number: 19, delivered: "F5" } }),
      event({ kind: "sprint_set", ticketId: "f5", source: "user", data: { from: "S42", to: "S43" } }),
    ],
    project,
    NOW,
  );
  expect(items.map((i) => [i.kind, i.text])).toEqual([
    ["pr_opened", "PR #22 ouverte · SILO-32"],
    ["step", "Phase 7/12 · Porte qualité · SILO-33"],
    ["agent", "Agent de projet · lot n° 7 proposé"],
    ["pr_merged", "PR #19 fusionnée · F5 livrée · SILO-31"],
    ["sprint", "F5 reportée en S43"],
  ]);
  expect(items[0]?.time).toBe("15:04");
});

test("the other facts of the journal read as on the ticket", () => {
  const texts = journalActivity(
    [
      event({ kind: "batch_decided", source: "project-agent", data: { seq: 7, decision: "apply" } }),
      event({ kind: "branch_created", ticketId: "e33", data: { branch: "feat/envoi-hors-ligne" } }),
      event({ kind: "branch_created", ticketId: "e34", data: { branch: "feat/x", declared: true } }),
      event({ kind: "session_started", ticketId: "e33", source: "full-delivery" }),
      event({ kind: "question_reminded", ticketId: "e34", source: "project-agent", data: { ref: "Q16" } }),
    ],
    project,
    NOW,
  ).map((i) => i.text);
  expect(texts).toEqual([
    "Lot n° 7 validé",
    "Branche feat/envoi-hors-ligne poussée · SILO-33",
    "Branche feat/x déclarée · SILO-34",
    "Session ouverte · SILO-33",
    "Q16 relancée · SILO-34",
  ]);
  const late = event({
    kind: "sprint_set",
    ticketId: "f5",
    source: "project-agent",
    data: { from: null, to: "S44" },
  });
  expect(journalActivity([late], project, NOW)[0]?.text).toBe("F5 planifiée en S44");
  const off = event({ kind: "sprint_set", ticketId: "f5", source: "user", data: { from: "S42", to: null } });
  expect(journalActivity([off], project, NOW)[0]?.text).toBe("F5 retirée du planning");
});

test("five lines at most, in the order of the journal", () => {
  const many = Array.from({ length: 8 }, (_, n) =>
    event({ kind: "step_set", ticketId: "e33", data: { step: n } }),
  );
  expect(journalActivity(many, project, NOW)).toHaveLength(5);
});

test("a broken CI reads « CI cassée », as on the ticket and in the CLI", () => {
  const broken = event({ kind: "pr_checks", ticketId: "e32", data: { number: 22, checks: "error" } });
  expect(journalActivity([broken], project, NOW)[0]?.text).toBe("CI cassée sur PR #22 · SILO-32");
});

test("a step put on hold or resumed gets the hold kind, with its key", () => {
  const items = journalActivity(
    [
      event({
        kind: "held",
        ticketId: "e33",
        source: "user",
        data: { reason: "Serveur MinIO de recette indisponible" },
      }),
      event({
        kind: "resumed",
        ticketId: "e33",
        source: "user",
        data: { reason: "Serveur MinIO de recette indisponible" },
      }),
    ],
    project,
    NOW,
  );
  expect(items.map((i) => [i.kind, i.text])).toEqual([
    ["hold", "Mise en attente · Serveur MinIO de recette indisponible · SILO-33"],
    ["hold", "Reprise · SILO-33"],
  ]);
});
