import {
  branchRefOf,
  type ExternalRef,
  GitBranchRef,
  KiboError,
  type ProjectCommand,
  type StatusId,
} from "@kibo/schema";
import { type NormalizedStatus, normalizedStatus, type StatusName, statusName } from "./ticket-view";

export type Assignments = {
  status: StatusName | null;
  pr: string | null;
  reason: string | null;
  branch: string | null;
  base: string | null;
};
type SetTarget = { id: string; statusId: StatusId; externalRefs: ExternalRef[] };
type SetStatus = Extract<ProjectCommand, { method: "setStatus" }>;
type UpsertRef = Extract<ProjectCommand, { method: "upsertExternalRef" }>;

const KEYS = new Set(["status", "pr", "reason", "branch", "base"]);

export function parseAssignments(args: readonly string[]): Assignments {
  if (args.length === 0)
    throw new KiboError("INVALID_INPUT", "nothing to set: use status=…, pr=… or branch=…");
  const values = new Map<string, string>();
  for (const arg of args) {
    const at = arg.indexOf("=");
    const key = at < 0 ? arg : arg.slice(0, at);
    if (at < 0 || !KEYS.has(key)) throw new KiboError("INVALID_INPUT", `unknown assignment: ${arg}`);
    values.set(key, arg.slice(at + 1));
  }
  if (values.has("base") && !values.has("branch"))
    throw new KiboError("INVALID_INPUT", "base= needs branch=");
  const status = values.get("status");
  return {
    status: status === undefined ? null : statusName(status),
    pr: values.get("pr") ?? null,
    reason: values.get("reason") ?? null,
    branch: values.get("branch") ?? null,
    base: values.get("base") ?? null,
  };
}

const KIBO_STATUS: Record<NormalizedStatus, StatusId> = {
  todo: "todo",
  wip: "in_progress",
  blocked: "blocked",
  done: "done",
};

const isNormalized = (s: StatusName): s is NormalizedStatus => s in KIBO_STATUS;

export function statusCommand(ticket: SetTarget, set: Assignments, defaultReason: string): SetStatus | null {
  if (set.status === null) return null;
  if (isNormalized(set.status) && normalizedStatus(ticket.statusId) === set.status) return null;
  const statusId = isNormalized(set.status) ? KIBO_STATUS[set.status] : set.status;
  if (statusId === ticket.statusId) return null;
  const base = { method: "setStatus" as const, ticketId: ticket.id, statusId };
  return statusId === "blocked" ? { ...base, reason: set.reason ?? defaultReason } : base;
}

const PR_URL = /^(https:\/\/github\.com\/[^/\s]+\/[^/\s]+)\/pull\/(\d+)$/;

function projectRepo(tickets: readonly SetTarget[]): string {
  const repos = new Set(
    tickets.flatMap((t) =>
      t.externalRefs.flatMap((r) => (r.kind === "github_pr" ? [PR_URL.exec(r.url)?.[1] ?? ""] : [])),
    ),
  );
  repos.delete("");
  const [repo, ...others] = [...repos];
  if (repo === undefined || others.length > 0)
    throw new KiboError("INVALID_INPUT", "repository unknown or ambiguous: pass pr=<url>");
  return repo;
}

function prUrl(value: string, tickets: readonly SetTarget[]): { url: string; number: number } {
  const full = PR_URL.exec(value.trim());
  if (full) return { url: full[0], number: Number(full[2]) };
  if (!/^[1-9]\d*$/.test(value.trim())) throw new KiboError("INVALID_INPUT", `invalid pr: ${value}`);
  const number = Number(value.trim());
  return { url: `${projectRepo(tickets)}/pull/${number}`, number };
}

export function prCommand(ticket: SetTarget, value: string, tickets: readonly SetTarget[]): UpsertRef | null {
  const { url, number } = prUrl(value, tickets);
  if (ticket.externalRefs.some((r) => r.kind === "github_pr" && r.url === url)) return null;
  return {
    method: "upsertExternalRef",
    ticketId: ticket.id,
    ref: {
      kind: "github_pr",
      url,
      number,
      state: "open",
      base: null,
      head: null,
      review: "none",
      checks: null,
    },
  };
}

export function branchRef(set: Assignments): GitBranchRef | null {
  if (set.branch === null) return null;
  const parsed = GitBranchRef.safeParse({ kind: "git_branch", branch: set.branch, base: set.base });
  if (!parsed.success)
    throw new KiboError(
      "INVALID_INPUT",
      `invalid branch: ${set.branch}${set.base === null ? "" : ` base=${set.base}`}`,
    );
  return parsed.data;
}

export function branchCommand(ticket: SetTarget, ref: GitBranchRef): UpsertRef | null {
  const current = branchRefOf(ticket.externalRefs);
  if (current?.branch === ref.branch && current.base === ref.base) return null;
  return { method: "upsertExternalRef", ticketId: ticket.id, ref };
}
