import type { Batch, ProjectSnapshot, ProposedAction, TicketView } from "@kibo/schema";
import { siloFeatureProject } from "../feature/fixture";

export const TODAY = "2026-10-16";

function withF4(project: ProjectSnapshot): ProjectSnapshot {
  const f5 = project.tickets.find((t) => t.id === "f5");
  if (!f5?.feature) throw new Error("fixture without F5");
  const f4: TicketView = {
    ...f5,
    id: "f4",
    key: "SILO-40",
    keyLabel: "SILO-40",
    shortKey: "F4",
    title: "Saisir un constat hors ligne",
    feature: { ...f5.feature, status: "open" },
  };
  const index = project.tickets.findIndex((t) => t.id === "f5");
  return { ...project, tickets: [...project.tickets.slice(0, index), f4, ...project.tickets.slice(index)] };
}

export const sprintProject = (): ProjectSnapshot => withF4(siloFeatureProject());

export function batch(actions: ProposedAction[], status: Batch["status"] = "pending"): Batch {
  return {
    id: "b7",
    projectId: "silo",
    runId: "r1",
    sessionId: "s1",
    seq: 7,
    summary: "Fin de S42",
    actions,
    expected: [],
    createdAt: 0,
    status,
    decidedBy: null,
    decidedAt: null,
    chosen: null,
    comment: null,
    results: [],
  };
}

export const moveF5: ProposedAction = {
  id: 1,
  why: "S42 finit ce soir",
  type: "setSprint",
  ticket: "SILO-30",
  sprint: "S43",
};
export const remindQ14: ProposedAction = {
  id: 2,
  why: "Q14 attend",
  type: "remindQuestion",
  questionId: "q14",
};
export const moveF7: ProposedAction = { id: 3, why: "", type: "setSprint", ticket: "SILO-70", sprint: null };
