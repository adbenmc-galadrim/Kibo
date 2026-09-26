import {
  DEFAULT_RULES,
  KiboError,
  type ProjectCommand,
  Rule,
  type StatusId,
  type Ticket,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";

export type RuleTrigger =
  | { kind: "run_started"; ticketId: string }
  | { kind: "run_done"; ticketId: string }
  | { kind: "status_changed"; ticketId: string };
export type RuleTicket = Pick<Ticket, "id" | "statusId" | "parentId">;

export function readRules(doc: LoroDoc): Rule[] {
  const stored = doc.getMap("rules").get("list");
  if (stored === undefined) return DEFAULT_RULES;
  const parsed = Rule.array().safeParse(stored);
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `rules: ${parsed.error.message}`);
  return parsed.data;
}

export function evaluateRules(rules: Rule[], trigger: RuleTrigger, tickets: RuleTicket[]): ProjectCommand[] {
  const status = new Map(tickets.map((t) => [t.id, t.statusId]));
  const parentOf = new Map(tickets.map((t) => [t.id, t.parentId]));
  const commands: ProjectCommand[] = [];
  const active = (when: Rule["when"]) => rules.filter((r) => r.enabled && r.when === when);
  const apply = (ticketId: string, rule: Rule) => {
    status.set(ticketId, rule.to);
    commands.push({ method: "setStatus", ticketId, statusId: rule.to });
  };
  const applicable = (when: Rule["when"], current: StatusId | undefined) =>
    current === undefined
      ? undefined
      : active(when).find((r) => r.from.includes(current) && r.to !== current);

  if (trigger.kind === "run_started" || trigger.kind === "run_done") {
    const rule = applicable(trigger.kind, status.get(trigger.ticketId));
    if (rule) apply(trigger.ticketId, rule);
  }

  const seen = new Set<string>();
  let child = trigger.ticketId;
  while (!seen.has(child)) {
    seen.add(child);
    const parentId = parentOf.get(child) ?? null;
    if (parentId === null) break;
    const siblings = tickets.filter((t) => t.parentId === parentId);
    if (!siblings.every((s) => status.get(s.id) === "done")) break;
    const rule = applicable("children_done", status.get(parentId));
    if (!rule) break;
    apply(parentId, rule);
    child = parentId;
  }
  return commands;
}
