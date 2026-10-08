import type { ExternalRef, GitBranchRef, ProjectCommand, Ticket } from "@kibo/schema";
import type { DesiredTicket } from "./desired";
import { refKey } from "./desired-tickets";
import type { TicketMemory } from "./import-memory";

export type FieldPhases = { edit: ProjectCommand[]; status: ProjectCommand[]; refs: ProjectCommand[] };
export type FieldOutcome = { written: string[]; kibo: string[]; memory: TicketMemory };
type Verdict = "same" | "write" | "kibo";
type Status = TicketMemory["status"];

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export const same = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);

const sameStatus = (a: Status, b: Status) =>
  a.statusId === b.statusId && (a.blockedReason?.trim() ?? null) === (b.blockedReason?.trim() ?? null);
const branchOf = (refs: readonly ExternalRef[]): GitBranchRef | null =>
  refs.find((r): r is GitBranchRef => r.kind === "git_branch") ?? null;
const branchesOf = (t: Ticket): GitBranchRef[] =>
  t.externalRefs.filter((r): r is GitBranchRef => r.kind === "git_branch");

export function desiredMemory(d: DesiredTicket): TicketMemory {
  return {
    title: d.title.trim(),
    description: d.description,
    labels: d.labels,
    parent: d.parent === null ? null : refKey(d.parent),
    status: { statusId: d.statusId, blockedReason: d.blockedReason },
    branch: branchOf(d.refs),
  };
}

function verdict(matchesPlan: boolean, remembered: boolean, untouched: () => boolean): Verdict {
  if (matchesPlan) return "same";
  if (!remembered) return "kibo";
  return untouched() ? "write" : "kibo";
}

export function fieldCommands(
  t: Ticket,
  d: DesiredTicket,
  parent: string | null,
  memory: TicketMemory | undefined,
  ids: ReadonlyMap<string, string>,
  phases: FieldPhases,
): FieldOutcome {
  const wanted = desiredMemory(d);
  const known = memory !== undefined;
  const written: string[] = [];
  const kibo: string[] = [];
  const next: TicketMemory = { ...wanted };
  const decide = <K extends keyof TicketMemory>(field: K, v: Verdict, name: string = field): boolean => {
    if (v === "write") written.push(name);
    if (v === "kibo") {
      kibo.push(`${field} (Kibo)`);
      if (memory) next[field] = memory[field];
    }
    return v === "write";
  };
  const patch: { title?: string; description?: string; labels?: string[] } = {};
  if (
    decide(
      "title",
      verdict(t.title === wanted.title, known, () => t.title === memory?.title),
    )
  )
    patch.title = wanted.title;
  const description = verdict(
    t.description === wanted.description,
    known,
    () => t.description === memory?.description,
  );
  if (decide("description", description)) patch.description = wanted.description;
  if (
    decide(
      "labels",
      verdict(same(t.labels, wanted.labels), known, () => same(t.labels, memory?.labels)),
    )
  )
    patch.labels = wanted.labels;
  if (Object.keys(patch).length > 0) phases.edit.push({ method: "updateTicket", ticketId: t.id, ...patch });
  const rememberedParent = () => (memory?.parent === null ? null : ids.get(memory?.parent ?? ""));
  if (
    decide(
      "parent",
      verdict(t.parentId === parent, known, () => t.parentId === rememberedParent()),
    )
  )
    phases.edit.push({ method: "moveTicket", ticketId: t.id, parentId: parent });
  const current = { statusId: t.statusId, blockedReason: t.blockedReason };
  const status = verdict(sameStatus(current, wanted.status), known, () =>
    memory ? sameStatus(current, memory.status) : false,
  );
  if (decide("status", status))
    phases.status.push({
      method: "setStatus",
      ticketId: t.id,
      statusId: wanted.status.statusId,
      ...(wanted.status.blockedReason === null ? {} : { reason: wanted.status.blockedReason }),
    });
  const branches = branchesOf(t);
  const hasBranch = (b: GitBranchRef | null) =>
    b === null ? branches.length === 0 : branches.some((x) => same(x, b));
  const target = wanted.branch;
  const branch = verdict(target === null || hasBranch(target), known, () =>
    hasBranch(memory?.branch ?? null),
  );
  if (decide("branch", branch, "git_branch") && target !== null)
    phases.refs.push({ method: "upsertExternalRef", ticketId: t.id, ref: target });
  return { written, kibo, memory: next };
}

export function describeFields(outcome: Pick<FieldOutcome, "written" | "kibo">, refs: readonly string[]) {
  const written = [...new Set([...outcome.written, ...refs])].join(", ");
  const kibo = outcome.kibo.join(", ");
  if (written) return { kind: "updated" as const, detail: kibo ? `${written}; ${kibo}` : written };
  return kibo ? { kind: "kept" as const, detail: kibo } : null;
}
