import {
  type ComponentDraft,
  type DraftIncident,
  type DraftStatus,
  KiboError,
  MAX_DRAFT_ATTEMPTS,
  MAX_DRAFT_REVISIONS,
} from "@kibo/schema";

export type DraftEvent =
  | { type: "enqueued"; runId: string }
  | { type: "revised"; runId: string }
  | {
      type: "run_ended";
      runId: string;
      state: "done" | "failed" | "cancelled";
      sessionId: string | null;
      error: string | null;
    }
  | { type: "restored"; incidents: DraftIncident[] }
  | { type: "validation_started" }
  | { type: "validated"; ok: boolean }
  | { type: "validation_crashed"; detail: string }
  | { type: "config_changed" }
  | { type: "reviewed" }
  | { type: "finalized" }
  | { type: "abandoned" }
  | { type: "interrupted" };

const TERMINAL: DraftStatus[] = ["done", "abandoned"];
const REVISABLE: DraftStatus[] = ["review", "permissions"];

export const isActive = (d: ComponentDraft): boolean => !TERMINAL.includes(d.status);

export const canRetry = (d: ComponentDraft): boolean =>
  d.status === "failed" && d.attempts < MAX_DRAFT_ATTEMPTS && d.failure?.kind !== "config_changed";

export const canRevise = (d: ComponentDraft): boolean =>
  REVISABLE.includes(d.status) && d.revisions < MAX_DRAFT_REVISIONS;

function assertStatus(d: ComponentDraft, allowed: DraftStatus[], event: DraftEvent["type"]) {
  if (!allowed.includes(d.status))
    throw new KiboError("INVALID_INPUT", `cannot apply ${event} to a ${d.status} draft`);
}

export function applyDraftEvent(d: ComponentDraft, e: DraftEvent, now: number): ComponentDraft {
  const next = (patch: Partial<ComponentDraft>): ComponentDraft => ({ ...d, ...patch, updatedAt: now });
  switch (e.type) {
    case "enqueued":
      assertStatus(d, ["describing", "failed"], e.type);
      if (d.attempts >= MAX_DRAFT_ATTEMPTS || d.failure?.kind === "config_changed")
        throw new KiboError("INVALID_INPUT", "no attempt left for this draft");
      return next({
        status: "generating",
        runId: e.runId,
        attempts: d.attempts + 1,
        failure: null,
        incidents: [],
      });
    case "revised":
      assertStatus(d, REVISABLE, e.type);
      if (d.revisions >= MAX_DRAFT_REVISIONS) throw new KiboError("INVALID_INPUT", "no revision left");
      return next({
        status: "generating",
        runId: e.runId,
        attempts: 1,
        revisions: d.revisions + 1,
        failure: null,
        incidents: [],
      });
    case "run_ended": {
      if (d.status !== "generating" || d.runId !== e.runId) return d;
      const sessionId = e.sessionId ?? d.sessionId;
      if (e.state === "done") return next({ status: "validating", sessionId });
      const kind = e.state === "failed" ? "run_failed" : "run_cancelled";
      return next({ status: "failed", sessionId, failure: { kind, detail: e.error } });
    }
    case "restored":
      assertStatus(d, ["validating", "failed"], e.type);
      return next({ incidents: e.incidents });
    case "validation_started":
      assertStatus(d, ["failed"], e.type);
      return next({ status: "validating", failure: null });
    case "validated":
      assertStatus(d, ["validating"], e.type);
      return next(
        e.ok ? { status: "review" } : { status: "failed", failure: { kind: "validation", detail: null } },
      );
    case "validation_crashed":
      assertStatus(d, ["validating"], e.type);
      return next({ status: "failed", failure: { kind: "validation", detail: e.detail } });
    case "config_changed":
      assertStatus(d, ["validating"], e.type);
      return next({ status: "failed", failure: { kind: "config_changed", detail: null } });
    case "reviewed":
      assertStatus(d, ["review"], e.type);
      return next({ status: "permissions" });
    case "finalized":
      assertStatus(d, ["permissions"], e.type);
      return next({ status: "done" });
    case "abandoned":
      if (!isActive(d)) throw new KiboError("INVALID_INPUT", `draft is already ${d.status}`);
      return next({ status: "abandoned" });
    case "interrupted":
      assertStatus(d, ["describing", "generating", "validating"], e.type);
      return next({ status: "failed", failure: { kind: "interrupted", detail: null } });
  }
}
