import {
  type AgentRef,
  type AgentSummary,
  type DeliveryPublication,
  EMPTY_DELIVERY,
  FULL_DELIVERY_AGENT,
  ProjectDelivery,
} from "@kibo/schema";
import { frDeliverySettings } from "../i18n/fr-delivery-settings";
import { expandHome, tildify } from "../lib/expand-home";

export const PATH_FIELDS = ["root", "profile", "memory", "briefs", "reports", "todo"] as const;
export type PathField = (typeof PATH_FIELDS)[number];
export type DeliveryDraft = Record<PathField, string> & { idPattern: string };
export type DeliveryChoices = {
  agent: AgentRef | null;
  publication: DeliveryPublication | null;
  allow: string[];
  addDirs: string[];
};
export type DeliveryResult = { value: ProjectDelivery | null; problem: string | null };

const t = frDeliverySettings.section;

export const sameDelivery = (a: ProjectDelivery | null, b: ProjectDelivery | null): boolean =>
  JSON.stringify(a ?? EMPTY_DELIVERY) === JSON.stringify(b ?? EMPTY_DELIVERY);

export function deliveryDraftOf(value: ProjectDelivery | null, home: string): DeliveryDraft {
  const current = value ?? EMPTY_DELIVERY;
  return {
    root: tildify(current.root ?? "", home),
    profile: tildify(current.profile ?? "", home),
    memory: tildify(current.memory ?? "", home),
    briefs: tildify(current.briefs ?? "", home),
    reports: tildify(current.reports ?? "", home),
    todo: tildify(current.todo ?? "", home),
    idPattern: current.idPattern ?? "",
  };
}

export const choicesOf = (value: ProjectDelivery | null): DeliveryChoices => {
  const current = value ?? EMPTY_DELIVERY;
  return {
    agent: current.agent,
    publication: current.publication,
    allow: current.allow,
    addDirs: current.addDirs,
  };
};

function pathOf(
  field: PathField,
  text: string,
  home: string,
): { path: string | null; problem: string | null } {
  if (text.trim() === "") return { path: null, problem: null };
  const path = expandHome(text, home);
  return path.startsWith("/") ? { path, problem: null } : { path: null, problem: t.pathError(t[field]) };
}

export function deliveryOf(draft: DeliveryDraft, choices: DeliveryChoices, home: string): DeliveryResult {
  const paths: Partial<Record<PathField, string | null>> = {};
  for (const field of PATH_FIELDS) {
    const { path, problem } = pathOf(field, draft[field], home);
    if (problem !== null) return { value: null, problem };
    paths[field] = path;
  }
  const idPattern = draft.idPattern.trim() === "" ? null : draft.idPattern.trim();
  const parsed = ProjectDelivery.safeParse({
    agent: choices.agent,
    root: paths.root ?? null,
    profile: paths.profile ?? null,
    memory: paths.memory ?? null,
    briefs: paths.briefs ?? null,
    reports: paths.reports ?? null,
    todo: paths.todo ?? null,
    idPattern,
    publication: choices.publication,
    allow: choices.allow,
    addDirs: choices.addDirs,
  });
  if (!parsed.success) {
    const idPatternRefused = parsed.error.issues[0]?.path[0] === "idPattern";
    return { value: null, problem: idPatternRefused ? t.patternError : t.invalid };
  }
  return { value: sameDelivery(parsed.data, null) ? null : parsed.data, problem: null };
}

export const hasGlobalDeliveryAgent = (agents: readonly AgentSummary[]): boolean =>
  agents.some((a) => a.scope === "global" && a.name === FULL_DELIVERY_AGENT && a.settings.enabled);
