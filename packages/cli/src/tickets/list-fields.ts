import { KiboError } from "@kibo/schema";
import { splitList } from "../args";
import type { TicketRef, TicketSummary } from "./ticket-view";

export type ListField = keyof TicketSummary;
type Extract = (t: TicketSummary) => unknown;

const asIs =
  (field: ListField): Extract =>
  (t) =>
    t[field];
const keysOf = (refs: readonly TicketRef[]): string[] => refs.map((r) => r.key);

const EXTRACTORS: Record<ListField, Extract> = {
  id: asIs("id"),
  key: asIs("key"),
  planId: asIs("planId"),
  title: asIs("title"),
  status: asIs("status"),
  kiboStatus: asIs("kiboStatus"),
  column: asIs("column"),
  blockedReason: asIs("blockedReason"),
  parent: (t) => t.parent?.key ?? null,
  children: (t) => keysOf(t.children),
  deps: (t) => keysOf(t.deps),
  pr: (t) => (t.pr === null ? null : { number: t.pr.number, url: t.pr.url, state: t.pr.state }),
  assignee: asIs("assignee"),
  branch: asIs("branch"),
  labels: asIs("labels"),
  delivery: asIs("delivery"),
  session: asIs("session"),
  updatedAt: asIs("updatedAt"),
  refs: asIs("refs"),
  startable: asIs("startable"),
  startReason: asIs("startReason"),
  onHold: asIs("onHold"),
  sprint: (t) => t.sprint?.code ?? null,
  feature: (t) => t.feature?.shortKey ?? t.feature?.key ?? null,
  optional: asIs("optional"),
};

const isListField = (name: string): name is ListField => Object.hasOwn(EXTRACTORS, name);

export const LIST_FIELDS: readonly ListField[] = Object.keys(EXTRACTORS).filter(isListField);

export const unknownField = (raw: string): string | null =>
  splitList(raw).find((name) => !isListField(name)) ?? null;

export function parseFields(raw: string): ListField[] {
  const unknown = unknownField(raw);
  if (unknown !== null) throw new KiboError("INVALID_INPUT", `unknown field: ${unknown}`);
  return splitList(raw).filter(isListField);
}

export function pickFields(t: TicketSummary, fields: readonly ListField[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => [field, EXTRACTORS[field](t)]));
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (Array.isArray(value))
    return value.map((item) => (typeof item === "string" ? item : cell(item))).join(",");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function fieldLines(rows: readonly Record<string, unknown>[], fields: readonly ListField[]): string[] {
  return [fields.join("\t"), ...rows.map((row) => fields.map((field) => cell(row[field])).join("\t"))];
}
