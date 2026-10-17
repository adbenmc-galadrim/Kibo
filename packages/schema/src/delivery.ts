import { z } from "zod";
import { AddDirs } from "./add-dir";
import { AgentRef, type AgentSettings, type AgentSummary } from "./agent";
import { AllowRules } from "./allow-rule";
import type { AgentsState } from "./run";

export const AbsPath = z
  .string()
  .min(1)
  .max(4096)
  .refine((p) => p.startsWith("/"), "path must be absolute");

const compiles = (pattern: string): boolean => {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

export const DeliveryPublication = z.enum(["draft", "local"]);
export type DeliveryPublication = z.infer<typeof DeliveryPublication>;

export const ProjectDelivery = z
  .object({
    agent: AgentRef.nullable(),
    root: AbsPath.nullable(),
    profile: AbsPath.nullable(),
    memory: AbsPath.nullable(),
    briefs: AbsPath.nullable(),
    reports: AbsPath.nullable(),
    todo: AbsPath.nullable(),
    idPattern: z.string().max(200).refine(compiles, "invalid regular expression").nullable(),
    publication: DeliveryPublication.nullable(),
    allow: AllowRules,
    addDirs: AddDirs,
  })
  .strict();
export type ProjectDelivery = z.infer<typeof ProjectDelivery>;

export const EMPTY_DELIVERY: ProjectDelivery = {
  agent: null,
  root: null,
  profile: null,
  memory: null,
  briefs: null,
  reports: null,
  todo: null,
  idPattern: null,
  publication: null,
  allow: [],
  addDirs: [],
};

export const DELIVERY_STEP_MAX = 11;
export const DeliveryKind = z.enum(["delivery", "update"]);
export type DeliveryKind = z.infer<typeof DeliveryKind>;
export const DeliveryStepNumber = z.number().int().min(0).max(DELIVERY_STEP_MAX);
export const DeliveryStep = z.object({
  step: DeliveryStepNumber,
  note: z.string().max(300),
  at: z.number().int(),
  runId: z.string().nullable(),
  kind: DeliveryKind.default("delivery"),
});
export type DeliveryStep = z.infer<typeof DeliveryStep>;

export const DELIVERY_STEP_LABELS: readonly string[] = [
  "Lecture",
  "Mémoire",
  "Repérage",
  "Questions",
  "Worktree",
  "Conception",
  "Code",
  "Porte qualité",
  "PR",
  "Review",
  "Démo",
  "Livré",
];

export const deliveryStepLabel = (step: number): string => `${step} · ${DELIVERY_STEP_LABELS[step] ?? ""}`;

export const FULL_DELIVERY_AGENT = "full-delivery";

type DeliveryCandidate = Pick<AgentSummary, "ref" | "scope" | "name"> & {
  settings: Pick<AgentSettings, "enabled">;
};

export function deliveryAgentOf(
  agents: readonly DeliveryCandidate[],
  delivery: ProjectDelivery | null,
): AgentRef | null {
  const chosen = agents.find((a) => a.ref === delivery?.agent && a.settings.enabled);
  if (chosen) return chosen.ref;
  const global = agents.find(
    (a) => a.scope === "global" && a.name === FULL_DELIVERY_AGENT && a.settings.enabled,
  );
  return global?.ref ?? null;
}

export const DeliveryAgent = z.object({ ref: AgentRef, name: z.string().min(1) });
export type DeliveryAgent = z.infer<typeof DeliveryAgent>;

export function deliveryAgentInfo(
  agents: readonly DeliveryCandidate[],
  delivery: ProjectDelivery | null,
): DeliveryAgent | null {
  const ref = deliveryAgentOf(agents, delivery);
  const agent = agents.find((a) => a.ref === ref);
  return agent ? { ref: agent.ref, name: agent.name } : null;
}

export const deliveryBrief = (ticketKey: string): string => `/full-delivery ${ticketKey}`;
export const updateDeliveryBrief = (ticketKey: string): string => `/update-delivery ${ticketKey}`;

export type RunDeliveryStep = { runId: string; step: number; note: string };
export const runDeliverySteps = (state: Pick<AgentsState, "delivery">): RunDeliveryStep[] =>
  state.delivery ?? [];
