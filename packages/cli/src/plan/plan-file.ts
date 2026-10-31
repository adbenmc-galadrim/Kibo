import { extname } from "node:path";
import { KiboError, PLAN_ACTIONS_MAX, PlanAction } from "@kibo/schema";
import type { ZodIssue } from "zod";

export type PlanFile = { summary: string | null; actions: PlanAction[] };
type PlanFormat = "yaml" | "json";

export const formatOf = (path: string): PlanFormat =>
  extname(path).toLowerCase() === ".json" ? "json" : "yaml";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function readText(text: string, format: PlanFormat): unknown {
  try {
    return format === "json" ? JSON.parse(text) : Bun.YAML.parse(text);
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `plan unreadable: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function rawActions(root: unknown): Record<string, unknown>[] {
  const actions = isRecord(root) ? root.actions : undefined;
  if (!Array.isArray(actions) || actions.length === 0)
    throw new KiboError("INVALID_INPUT", "plan: actions must be a non-empty list");
  if (actions.length > PLAN_ACTIONS_MAX)
    throw new KiboError("INVALID_INPUT", `plan: at most ${PLAN_ACTIONS_MAX} actions`);
  return actions.map((a) => (isRecord(a) ? a : { value: a }));
}

function withDefaults(actions: Record<string, unknown>[]): Record<string, unknown>[] {
  const given = actions.filter((a) => a.id !== undefined).length;
  if (given !== 0 && given !== actions.length)
    throw new KiboError("INVALID_INPUT", "plan: give every action an id, or none");
  return actions.map((a, index) => ({ ...a, id: a.id ?? index + 1, why: a.why ?? "" }));
}

const issueText = (issue: ZodIssue): string => [...issue.path, issue.message].join(" ");

export function parsePlanText(text: string, format: PlanFormat): PlanFile {
  const root = readText(text, format);
  const actions: PlanAction[] = [];
  const faults: string[] = [];
  withDefaults(rawActions(root)).forEach((raw, index) => {
    const parsed = PlanAction.safeParse(raw);
    if (parsed.success) actions.push(parsed.data);
    else faults.push(`action ${index + 1}: ${parsed.error.issues.map(issueText).join("; ")}`);
  });
  if (faults.length > 0) throw new KiboError("VALIDATION_FAILED", faults.join("\n"));
  const summary = isRecord(root) && typeof root.summary === "string" ? root.summary : null;
  return { summary, actions };
}
