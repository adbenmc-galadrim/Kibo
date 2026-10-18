import type { CiTone, StartReason } from "@kibo/schema";
import type { WorkGroup } from "../mine/work-list";

export const frMine = {
  groups: {
    toFix: "À reprendre",
    inProgress: "En cours",
    startable: "Démarrable",
    waiting: "En attente",
  } satisfies Record<WorkGroup, string>,
  hints: {
    toFix: "changements demandés ou CI cassée",
    inProgress: "branche ou PR ouverte",
    startable: "à lancer avec /full-delivery",
    waiting: "bloqué, dépendance ou sprint à venir",
  } satisfies Record<WorkGroup, string>,
  ci: { ok: "CI", error: "CI cassée", running: "CI en cours", neutral: "CI" } satisfies Record<
    CiTone,
    string
  >,
  changesRequested: "changements demandés",
  blockedBy: (question: string) => `bloqué · ${question}`,
  blocked: "bloqué",
  waitingOn: (keys: readonly string[]) => `attend ${keys.join(", ")}`,
  reason: (reason: StartReason): string | null => {
    switch (reason.kind) {
      case "dependency":
        return `attend ${reason.keys.join(", ")}`;
      case "question":
        return `bloqué · ${reason.label}`;
      case "sprint":
        return `prévu en ${reason.code}`;
      case "unplanned":
        return "hors sprint";
      case "limit":
        return `limite de ${reason.limit} en cours`;
      case "status":
        return null;
    }
  },
  copy: (command: string) => `Copier ${command}`,
};
