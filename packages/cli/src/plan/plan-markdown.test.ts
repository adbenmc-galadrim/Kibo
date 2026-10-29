import { describe, expect, test } from "bun:test";
import type { FeatureState, ProjectSnapshot, TicketView } from "@kibo/schema";
import { fakeSnapshot, fakeTicket, SPRINTS } from "../commands/tickets-test-kit";
import { planMarkdown } from "./plan-markdown";

const blockedF7: FeatureState = {
  status: "blocked",
  steps: { done: 1, total: 2, mandatoryDone: 1, mandatoryTotal: 2 },
  nextStepId: "c",
  remaining: 1,
  started: true,
  held: 0,
};
const held = { source: "own" as const, key: "SILO-41", reason: "Accès client", since: "2026-10-16" };

const tickets: TicketView[] = [
  fakeTicket({ id: "f5", key: "SILO-30", shortKey: "F5", sprintId: "s42", children: 2 }),
  {
    ...fakeTicket({
      id: "a",
      key: "SILO-33",
      parentId: "f5",
      effectiveSprintId: "s42",
      statusId: "in_review",
    }),
    openQuestions: 1,
  },
  {
    ...fakeTicket({ id: "b", key: "SILO-34", parentId: "f5", effectiveSprintId: "s42", optional: true }),
    waitingOn: ["SILO-33"],
  },
  { ...fakeTicket({ id: "f7", key: "SILO-40", shortKey: "F7", children: 2 }), feature: blockedF7 },
  fakeTicket({ id: "c", key: "SILO-41", parentId: "f7", statusId: "in_progress", onHold: held }),
  fakeTicket({ id: "d", key: "SILO-42", parentId: "f7", statusId: "done" }),
  fakeTicket({ id: "f8", key: "SILO-60", shortKey: "F8", sprintId: "s41", children: 1 }),
  fakeTicket({ id: "e", key: "SILO-61", parentId: "f8", effectiveSprintId: "s41", statusId: "done" }),
  { ...fakeTicket({ id: "solo", key: "SILO-50" }), waitingOn: ["SILO-41"], openQuestions: 2 },
];

const snapshot: ProjectSnapshot = {
  ...fakeSnapshot(tickets, SPRINTS),
  links: [{ id: "l1", from: "a", to: "b", type: "blocks" }],
};

const EXPECTED = `# SILO · Silo

## S41 · Accès (2026-09-28 → 2026-10-09, terminé)

### F8 · Titre SILO-60 — livrée (1/1)

- [x] SILO-61 Titre SILO-61 — Terminé

## S42 · Saisie hors ligne (2026-10-12 → 2026-10-23, en cours)

### F5 · Titre SILO-30 — ouverte (0/1)

- [~] SILO-33 Titre SILO-33 — En review · 1 question ouverte
- [ ] SILO-34 Titre SILO-34 — À faire · attend SILO-33 · facultative

## Sans sprint

### F7 · Titre SILO-40 — bloquée (1/2)

- [⏸] SILO-41 Titre SILO-41 — En cours · en attente : Accès client
- [x] SILO-42 Titre SILO-42 — Terminé

## Hors fonctionnalité

- [ ] SILO-50 Titre SILO-50 — À faire · attend SILO-41 · 2 questions ouvertes
`;

describe("planMarkdown", () => {
  test("writes sprints in order, then the unplanned features, then the lone tickets", () => {
    expect(planMarkdown(snapshot)).toBe(EXPECTED);
  });

  test("is deterministic and ends with a single newline", () => {
    expect(planMarkdown(snapshot)).toBe(planMarkdown(snapshot));
    expect(planMarkdown(snapshot).endsWith("\n")).toBe(true);
    expect(planMarkdown(snapshot).endsWith("\n\n")).toBe(false);
  });

  test("leaves out empty sections", () => {
    const lone = fakeSnapshot([fakeTicket({ id: "solo", key: "SILO-50" })], SPRINTS);
    expect(planMarkdown(lone)).toBe(
      "# SILO · Silo\n\n## Hors fonctionnalité\n\n- [ ] SILO-50 Titre SILO-50 — À faire\n",
    );
    expect(planMarkdown(fakeSnapshot([], []))).toBe("# SILO · Silo\n");
  });

  test("orders steps by their dependencies", () => {
    const reversed: ProjectSnapshot = {
      ...snapshot,
      links: [{ id: "l1", from: "b", to: "a", type: "blocks" }],
    };
    const lines = planMarkdown(reversed).split("\n");
    const at = (key: string) => lines.findIndex((l) => l.startsWith("- [") && l.includes(`] ${key} `));
    expect(at("SILO-34")).toBeLessThan(at("SILO-33"));
  });
});
