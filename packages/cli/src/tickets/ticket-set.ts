import {
  branchRefOf,
  type ExternalRef,
  GitBranchRef,
  type GithubPrRef,
  HOLD_REASON_MAX,
  HoldReason,
  KiboError,
  type ProjectCommand,
  type StatusId,
} from "@kibo/schema";
import { frTickets } from "../fr";
import { type NormalizedStatus, normalizedStatus, type StatusName, statusName } from "./ticket-view";

export type Assignments = {
  status: StatusName | null;
  pr: string | null;
  reason: string | null;
  branch: string | null;
  base: string | null;
  hold?: string | null;
};
type SetTarget = { id: string; statusId: StatusId; externalRefs: ExternalRef[] };
type SetStatus = Extract<ProjectCommand, { method: "setStatus" }>;
type SetHold = Extract<ProjectCommand, { method: "setHold" }>;

const KEYS = new Set(["status", "pr", "reason", "branch", "base", "hold"]);
const RESUME = "off";

function holdOf(raw: string): string | null {
  if (raw.trim() === "") throw new KiboError("INVALID_INPUT", frTickets.hold.empty);
  if (raw.trim() === RESUME) return null;
  const parsed = HoldReason.safeParse(raw);
  if (!parsed.success)
    throw new KiboError("INVALID_INPUT", `hold reason longer than ${HOLD_REASON_MAX} characters`);
  return parsed.data;
}

export function parseAssignments(args: readonly string[]): Assignments {
  if (args.length === 0)
    throw new KiboError("INVALID_INPUT", "nothing to set: use status=…, pr=…, branch=… or hold=…");
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
  const hold = values.get("hold");
  return {
    status: status === undefined ? null : statusName(status),
    pr: values.get("pr") ?? null,
    reason: values.get("reason") ?? null,
    branch: values.get("branch") ?? null,
    base: values.get("base") ?? null,
    ...(hold === undefined ? {} : { hold: holdOf(hold) }),
  };
}

export function holdCommand(
  ticket: { id: string; hold: { reason: string } | null },
  set: Assignments,
): SetHold | null {
  if (set.hold === undefined || set.hold === (ticket.hold?.reason ?? null)) return null;
  return { method: "setHold", ticketId: ticket.id, reason: set.hold };
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

export function prRef(ticket: SetTarget, value: string, tickets: readonly SetTarget[]): GithubPrRef | null {
  const { url, number } = prUrl(value, tickets);
  if (ticket.externalRefs.some((r) => r.kind === "github_pr" && r.url === url)) return null;
  return {
    kind: "github_pr",
    url,
    number,
    state: "open",
    base: null,
    head: null,
    review: "none",
    checks: null,
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

export function branchToDeclare(ticket: SetTarget, ref: GitBranchRef): GitBranchRef | null {
  const current = branchRefOf(ticket.externalRefs);
  return current?.branch === ref.branch && current.base === ref.base ? null : ref;
}
