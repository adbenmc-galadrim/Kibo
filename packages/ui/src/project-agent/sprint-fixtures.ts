import type { ProjectSnapshot, SprintView } from "@kibo/schema";
import { questionsProject } from "./fixtures";

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
  lingering: false,
});

export function sprintProject(): ProjectSnapshot {
  const base = questionsProject();
  const [f5, f9] = base.tickets;
  if (!f5 || !f9) throw new Error("fixture without tickets");
  return {
    ...base,
    sprints: [sprint("s42", "S42", "Saisie hors ligne"), sprint("s44", "S44", "Clôture")],
    tickets: [
      { ...f5, key: "SILO-30", keyLabel: "SILO-30", shortKey: "F5", sprintId: "s42" },
      { ...f9, key: "SILO-50", keyLabel: "SILO-50", shortKey: "F9", sprintId: null },
    ],
    questions: base.questions.map((q) =>
      q.id === "q-logo" ? { ...q, importRef: { kind: "import_ref", source: "silo", id: "Q14" } } : q,
    ),
  };
}
