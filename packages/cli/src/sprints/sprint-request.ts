import { KiboError, SprintDate, type SprintPatch } from "@kibo/schema";
import { flagText, type Parsed } from "../args";
import { frSprints } from "../fr-sprints";

type Flags = Parsed["flags"];

export type SprintRequest =
  | { kind: "create"; code: string; name: string; start: string; end: string }
  | { kind: "update"; target: string; patch: SprintPatch }
  | { kind: "assign"; ticket: string; sprint: string | null };

const PATCH_FIELDS = ["code", "name", "start", "end"] as const;

function createRequest(code: string | undefined, flags: Flags): SprintRequest | null {
  const start = flagText(flags, "start");
  const end = flagText(flags, "end");
  if (code === undefined || start === null || end === null) return null;
  return { kind: "create", code, name: flagText(flags, "name") ?? code, start, end };
}

function updateRequest(target: string | undefined, flags: Flags): SprintRequest | null {
  const patch: SprintPatch = {};
  for (const field of PATCH_FIELDS) {
    const value = flagText(flags, field);
    if (value !== null) patch[field] = value;
  }
  if (target === undefined || Object.keys(patch).length === 0) return null;
  return { kind: "update", target, patch };
}

function assignRequest(ticket: string | undefined, sprint: string | undefined, flags: Flags) {
  const none = flags.none === true;
  if (ticket === undefined || (sprint === undefined) === !none) return null;
  return { kind: "assign" as const, ticket, sprint: sprint ?? null };
}

function requestOf(positional: readonly string[], flags: Flags): SprintRequest | null {
  const [sub, first, second] = positional;
  if (sub === "create") return createRequest(first, flags);
  if (sub === "update") return updateRequest(first, flags);
  if (sub === "assign") return assignRequest(first, second, flags);
  return null;
}

export function sprintRequest(positional: readonly string[], flags: Flags): SprintRequest | null {
  try {
    return requestOf(positional, flags);
  } catch (e) {
    if (e instanceof KiboError && e.code === "INVALID_INPUT") return null;
    throw e;
  }
}

export const endsBeforeStart = (dates: { start: string; end: string }): boolean => dates.end < dates.start;

export function dateProblem(req: SprintRequest): string | null {
  if (req.kind === "assign") return null;
  const dates = req.kind === "create" ? req : req.patch;
  const invalid = [dates.start, dates.end].find((d) => d !== undefined && !SprintDate.safeParse(d).success);
  if (invalid !== undefined) return frSprints.invalidDate(invalid);
  return req.kind === "create" && endsBeforeStart(req) ? frSprints.endBeforeStart : null;
}
