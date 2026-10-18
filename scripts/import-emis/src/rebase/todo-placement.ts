export type TodoPlacement = Record<string, { feature: string; as: "step" | "question" }>;

export const TODO_PLACEMENT: TodoPlacement = {
  "DATA-1": { feature: "C3", as: "question" },
  "DATA-2": { feature: "C5", as: "question" },
  "PLAN-1": { feature: "C2", as: "step" },
  "DEV-1": { feature: "C0", as: "step" },
  "DEV-2": { feature: "CE", as: "step" },
  "DEV-3": { feature: "C9", as: "step" },
  "DEV-4": { feature: "C0", as: "step" },
  "RFID-1": { feature: "C6", as: "step" },
  "RFID-2": { feature: "C6", as: "step" },
};
