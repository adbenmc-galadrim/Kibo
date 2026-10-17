import { expect, test } from "bun:test";
import type { ProjectEvent, ProjectEventKind, ProjectEventSource } from "@kibo/schema";
import { activityLabel } from "./activity-labels";

const event = (
  kind: ProjectEventKind,
  data: ProjectEvent["data"] = {},
  source: ProjectEventSource = "git",
): ProjectEvent => ({ id: 1, projectId: "p", at: 0, kind, ticketId: null, featureId: null, source, data });
const label = (e: ProjectEvent, subject = "F5") =>
  activityLabel(e, { subject, statusName: (id) => `«${id}»` });

test("pull requests read as opened, merged, reviewed or checked", () => {
  expect(label(event("pr_opened", { number: 22 }))).toBe("PR #22 ouverte");
  expect(label(event("pr_merged", { number: 18, delivered: "F3" }))).toBe("PR #18 fusionnée · F3 livrée");
  expect(label(event("pr_merged", { number: 18 }))).toBe("PR #18 fusionnée");
  expect(label(event("pr_review", { number: 20, review: "changes_requested" }))).toBe(
    "PR #20 · changements demandés",
  );
  expect(label(event("pr_review", { number: 20, review: "approved" }))).toBe("PR #20 approuvée");
  expect(label(event("pr_review", { number: 20, review: "review_required" }))).toBe(
    "PR #20 · review demandée",
  );
  expect(label(event("pr_checks", { number: 22, checks: "ok" }))).toBe("PR #22 · CI verte");
  expect(label(event("pr_checks", { number: 22, checks: "error" }))).toBe("PR #22 · CI rouge");
  expect(label(event("pr_checks", { number: 22, checks: "running" }))).toBe("PR #22 · CI en cours");
  expect(label(event("branch_created", { branch: "feat/envoi" }))).toBe("Branche feat/envoi créée");
});

test("steps, sessions and statuses read with their label", () => {
  expect(label(event("step_set", { step: 7 }, "full-delivery"))).toBe("Étape 7 · Porte qualité");
  expect(label(event("step_set", { step: 2 }, "update-delivery"))).toBe("Retouche · 2 · Repérage");
  expect(label(event("session_started", {}, "full-delivery"))).toBe("Session démarrée");
  expect(label(event("session_stopped", { minutes: 42 }, "full-delivery"))).toBe("Session terminée · 42 min");
  expect(label(event("session_stopped", {}, "full-delivery"))).toBe("Session terminée");
  expect(label(event("status_changed", { to: "in_review" }, "user"))).toBe("Statut : «in_review»");
  expect(label(event("status_changed", { to: "done", delivered: "F3" }, "user"))).toBe(
    "Statut : «done» · F3 livrée",
  );
});

test("batches, sprints and questions read as the agent and the plan say", () => {
  expect(label(event("batch_proposed", { seq: 7 }, "project-agent"))).toBe(
    "Suivi mis à jour · lot n° 7 proposé",
  );
  expect(label(event("batch_decided", { seq: 7, status: "applied" }, "user"))).toBe("Lot n° 7 validé");
  expect(label(event("batch_decided", { seq: 7, status: "partial" }, "user"))).toBe(
    "Lot n° 7 validé en partie",
  );
  expect(label(event("batch_decided", { seq: 7, status: "rejected" }, "user"))).toBe("Lot n° 7 refusé");
  expect(label(event("sprint_set", { from: "S42", to: "S43" }, "user"))).toBe("F5 reportée en S43");
  expect(label(event("sprint_set", { from: null, to: "S44" }, "user"), "F9")).toBe("F9 planifiée en S44");
  expect(label(event("sprint_set", { from: "S42", to: null }, "user"))).toBe("F5 retirée du planning");
  expect(label(event("sprint_created", { code: "S45" }, "user"))).toBe("Sprint S45 créé");
  expect(label(event("question_created", { ref: "Q14" }, "user"))).toBe("Question Q14 posée");
  expect(label(event("question_answered", { ref: "Q14" }, "user"))).toBe("Q14 répondue");
  expect(label(event("question_reminded", { ref: "Q14" }, "project-agent"))).toBe("Q14 relancée");
});
