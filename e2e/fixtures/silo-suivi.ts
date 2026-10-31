import { fileURLToPath } from "node:url";
import { type SprintCode, siloKey } from "./silo-maquettes";

type SessionSpec = { n: number; tool: string };
type BatchActionSpec =
  | { id: number; type: "setSprint"; ticket: string; sprint: SprintCode | null; why: string }
  | { id: number; type: "remindQuestion"; question: string; why: string };
type BatchSpec = { seq: number; summary: string; actions: readonly BatchActionSpec[] };

export const SILO_SCENARIO = fileURLToPath(
  new URL("../agents/scenarios/silo-maquettes.json", import.meta.url),
);

export const SILO_DESCRIPTION = "Location de box";

export const SILO_SESSIONS: readonly SessionSpec[] = [
  { n: 33, tool: "T3 Code" },
  { n: 45, tool: "T3 Code" },
];

export const SILO_AGENT_PROMPT = "Fais le point du jour";

export const SILO_DAY_SUMMARY = [
  "F3 est livrée : 3 fonctionnalités sur 9.",
  "S42 finit ce soir et F5 n'y tiendra pas : il lui reste 4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo.",
].join("\n\n");

export const SILO_BATCH: BatchSpec = {
  seq: 7,
  summary: SILO_DAY_SUMMARY,
  actions: [
    {
      id: 1,
      type: "setSprint",
      ticket: siloKey(30),
      sprint: "S43",
      why: "4 étapes restantes, S42 finit aujourd'hui",
    },
    { id: 2, type: "setSprint", ticket: siloKey(90), sprint: "S44", why: "seule fonctionnalité à planifier" },
    { id: 3, type: "remindQuestion", question: "Q14", why: "bloque F6, prévue en S43" },
  ],
};

export const SILO_CLOSING = { merged: 18, delivery: 33, opened: 22 } as const;

export const SILO_LATE_PR = 20;

export type FactSpec = { kind: string; key: string | null; data: Record<string, string | number> };

export const SILO_LAST_FACTS: readonly FactSpec[] = [
  { kind: "pr_merged", key: siloKey(21), data: { number: SILO_CLOSING.merged, delivered: "F3" } },
  { kind: "batch_proposed", key: null, data: { seq: SILO_BATCH.seq } },
  { kind: "step_set", key: siloKey(SILO_CLOSING.delivery), data: { step: 7 } },
  { kind: "pr_opened", key: siloKey(32), data: { number: SILO_CLOSING.opened } },
];
