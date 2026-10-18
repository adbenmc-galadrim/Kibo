import { expect, test } from "bun:test";
import type { ProposedAction } from "@kibo/schema";
import { actionTitle, groupActions, projectLabels } from "./batch-groups";
import { trackingProject } from "./tracking-fixtures";

test("sprint actions form the Sprints group, right after Tickets", () => {
  const actions: ProposedAction[] = [
    { id: 1, type: "remindQuestion", questionId: "q-logo", why: "" },
    { id: 2, type: "setSprint", ticket: "SILO-30", sprint: "S43", why: "" },
    { id: 3, type: "createTicket", ref: "new:1", title: "Tests", why: "" },
    {
      id: 4,
      type: "createSprint",
      code: "S45",
      name: "Clôture",
      start: "2026-11-02",
      end: "2026-11-06",
      why: "",
    },
  ];
  expect(groupActions(actions).map((g) => [g.group, g.actions.map((a) => a.id)])).toEqual([
    ["tickets", [3]],
    ["sprints", [2, 4]],
    ["questions", [1]],
  ]);
});

test("sprint and reminder actions are named with the short key, the sprint codes and the recipient", () => {
  const labels = projectLabels(trackingProject());
  const title = (action: ProposedAction) => actionTitle(action, labels);
  expect(title({ id: 1, type: "setSprint", ticket: "SILO-30", sprint: "S43", why: "" })).toBe(
    "Reporter F5 en S43",
  );
  expect(title({ id: 1, type: "setSprint", ticket: "SILO-50", sprint: "S44", why: "" })).toBe(
    "Planifier F9 en S44",
  );
  expect(title({ id: 1, type: "setSprint", ticket: "SILO-50", sprint: null, why: "" })).toBe(
    "Retirer F9 du planning",
  );
  expect(
    title({
      id: 1,
      type: "createSprint",
      code: "S45",
      name: "Clôture",
      start: "2026-11-02",
      end: "2026-11-06",
      why: "",
    }),
  ).toBe("Créer le sprint S45 · Clôture");
  expect(title({ id: 1, type: "remindQuestion", questionId: "q-logo", why: "" })).toBe(
    "Relancer le client sur Q14",
  );
  expect(title({ id: 1, type: "remindQuestion", questionId: "q-port", why: "" })).toBe(
    "Relancer Moi (technique) sur « Quel port ? »",
  );
  expect(title({ id: 1, type: "remindQuestion", questionId: "gone", why: "" })).toBe(
    "Relancer « question introuvable »",
  );
  expect(actionTitle({ id: 1, type: "setSprint", ticket: "SILO-30", sprint: "S43", why: "" })).toBe(
    "Planifier SILO-30 en S43",
  );
});

test("the generic Client recipient is written « le client », a named recipient keeps its name", () => {
  const project = trackingProject();
  const named = {
    ...project,
    questions: project.questions.map((q) => (q.id === "q-logo" ? { ...q, recipient: "galadrim" } : q)),
  };
  const remind: ProposedAction = { id: 1, type: "remindQuestion", questionId: "q-logo", why: "" };
  expect(actionTitle(remind, projectLabels(project))).toBe("Relancer le client sur Q14");
  expect(actionTitle(remind, projectLabels(named))).toBe("Relancer Galadrim sur Q14");
});
