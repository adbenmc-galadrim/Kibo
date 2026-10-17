import type { Batch, ProjectSnapshot, ProposedAction, SprintView } from "@kibo/schema";
import { pendingBatch, questionsProject } from "./fixtures";

const sprint = (id: string, code: string, name: string): SprintView => ({
  id,
  code,
  name,
  start: "2026-10-12",
  end: "2026-10-16",
  state: "current",
  features: [],
  delivered: 0,
  total: 0,
});

export function trackingProject(): ProjectSnapshot {
  const base = questionsProject();
  const [f5, f9] = base.tickets;
  if (!f5 || !f9) throw new Error("fixture without tickets");
  return {
    ...base,
    sprints: [sprint("s42", "S42", "Terrain hors ligne"), sprint("s44", "S44", "Clôture")],
    tickets: [
      { ...f5, key: "EMIS-30", keyLabel: "EMIS-30", shortKey: "F5", sprintId: "s42" },
      { ...f9, key: "EMIS-50", keyLabel: "EMIS-50", shortKey: "F9", sprintId: null },
    ],
    questions: base.questions.map((q) =>
      q.id === "q-logo" ? { ...q, importRef: { kind: "import_ref", source: "emis", id: "Q14" } } : q,
    ),
  };
}

export const TRACKING_ACTIONS: ProposedAction[] = [
  {
    id: 1,
    type: "setSprint",
    ticket: "EMIS-30",
    sprint: "S43",
    why: "4 étapes restantes, S42 finit aujourd'hui",
  },
  { id: 2, type: "setSprint", ticket: "EMIS-50", sprint: "S44", why: "seule fonctionnalité à planifier" },
  { id: 3, type: "remindQuestion", questionId: "q-logo", why: "bloque F6, prévue en S43" },
];

export const trackingBatch = (p: Partial<Batch> = {}): Batch =>
  pendingBatch({ id: "b7", seq: 7, actions: TRACKING_ACTIONS, expected: [], ...p });
