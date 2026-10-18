import { expect, test } from "bun:test";
import type { PrChecks, PrReview } from "@kibo/schema";
import { detailLines, listLines, type TicketDetail } from "./ticket-text";

const pr = (review: PrReview, checks: PrChecks | null) => ({
  number: 20,
  url: "https://github.com/galadrim/emis/pull/20",
  state: "open" as const,
  review,
  checks,
});

const DETAIL: TicketDetail = {
  id: "t",
  key: "EMIS-15",
  planId: null,
  title: "Synchro",
  status: "done",
  kiboStatus: "done",
  column: "Terminé",
  blockedReason: null,
  parent: null,
  children: [],
  deps: [],
  pr: null,
  assignee: null,
  branch: null,
  labels: [],
  sprint: null,
  feature: null,
  optional: false,
  delivery: null,
  session: null,
  updatedAt: null,
  refs: [],
  startable: false,
  startReason: { kind: "status" },
  questions: [],
  notes: [],
  brief: null,
  description: "",
};

const lines = (patch: Partial<TicketDetail>) => detailLines({ ...DETAIL, ...patch });

test("shows the session with its local start time", () => {
  const startedAt = new Date(2026, 9, 16, 14, 10).getTime();
  expect(lines({ session: { tool: "T3 Code", startedAt } })).toContain("Session : T3 Code · depuis 14:10");
  expect(lines({}).some((l) => l.startsWith("Session"))).toBe(false);
});

test("shows a touch-up step, not a delivery one", () => {
  const delivery = { step: 7, note: "", at: 1, runId: null, kind: "update" as const };
  expect(lines({ delivery })).toContain("Retouche : 7/11 · Porte qualité");
  expect(lines({ delivery: { ...delivery, kind: "delivery" } }).some((l) => l.startsWith("Retouche"))).toBe(
    false,
  );
});

test("shows the review and the CI of the PR", () => {
  const url = "https://github.com/galadrim/emis/pull/20";
  expect(lines({ pr: pr("changes_requested", "error") })).toContain(
    `PR : #20 (open) · changements demandés · CI cassée · ${url}`,
  );
  expect(lines({ pr: pr("approved", "ok") })).toContain(`PR : #20 (open) · approuvée · CI verte · ${url}`);
  expect(lines({ pr: pr("review_required", "running") })).toContain(`PR : #20 (open) · CI en cours · ${url}`);
  expect(lines({ pr: pr("none", null) })).toContain(`PR : #20 (open) · ${url}`);
  expect(lines({})).toContain("PR : aucune");
});

const F4 = { key: "EMIS-40", shortKey: "F4", title: "Saisir un tronçon hors ligne" };

test("names a client demo step after its feature", () => {
  expect(lines({ title: "Démo client", feature: F4 })[0]).toBe("EMIS-15 · Démo · F4");
  expect(lines({ title: "démo CLIENT ", feature: { ...F4, shortKey: null } })[0]).toBe(
    "EMIS-15 · Démo · EMIS-40",
  );
  expect(lines({ title: "Démo client" })[0]).toBe("EMIS-15 · Démo client");
});

test("shows the declared branch", () => {
  expect(lines({ branch: { name: "feat/x", base: "dev" } })).toContain("Branche : feat/x (base dev)");
  expect(lines({ branch: { name: "feat/x", base: null } })).toContain("Branche : feat/x");
  expect(lines({})).toContain("Branche : aucune");
});

test("names the assignee", () => {
  const human = { kind: "human" as const, ref: "7787aae9", name: null, me: false };
  expect(lines({ assignee: { ...human, name: "Adam" } })).toContain("Assigné : Adam");
  expect(lines({ assignee: { ...human, me: true } })).toContain("Assigné : moi");
  expect(lines({ assignee: human })).toContain("Assigné : 7787aae9");
  expect(lines({ assignee: { kind: "agent", ref: "livraison", name: null, me: false } })).toContain(
    "Assigné : agent livraison",
  );
  expect(lines({})).toContain("Assigné : personne");
});

test("says when there is no description", () => {
  expect(lines({}).slice(-1)).toEqual(["Description : aucune"]);
  expect(lines({ description: "Tout le détail." }).slice(-2)).toEqual(["Description :", "Tout le détail."]);
});

test("lists tickets under aligned headers with their feature", () => {
  const rows = listLines([
    { ...DETAIL, key: "EMIS-46", title: "Démo client", feature: F4, status: "todo" },
    { ...DETAIL, key: "EMIS-100", planId: "C1-2", title: "Socle" },
  ]);
  expect(rows).toEqual([
    "Clé       Plan  F   Statut  Titre",
    "EMIS-46   -     F4  todo    Démo · F4",
    "EMIS-100  C1-2  -   done    Socle",
  ]);
});

test("drops the plan column when no ticket has a plan id", () => {
  const rows = listLines([
    { ...DETAIL, key: "EMIS-46", title: "Démo client", feature: F4, status: "todo" },
    { ...DETAIL, key: "EMIS-100", title: "Socle" },
  ]);
  expect(rows).toEqual([
    "Clé       F   Statut  Titre",
    "EMIS-46   F4  todo    Démo · F4",
    "EMIS-100  -   done    Socle",
  ]);
});
