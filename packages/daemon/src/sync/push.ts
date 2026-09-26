import { planSync, projectLocal, SYNCED_FIELDS, settleAfterPush } from "@kibo/core";
import { type Binding, KiboError, type SyncReport, type TicketView } from "@kibo/schema";
import type { EventLog } from "../integrations/events";
import type { AdapterRunner, IntegrationHost } from "../integrations/types";
import { applyPlan, SYNC, statusMapOf } from "./apply";
import { fieldsHash } from "./hash";
import { IGNORED, type OutboxRow, type SyncStore } from "./sync-store";

export type PauseGate = { blockedUntil(): number | null };
export type EngineDeps = {
  host: IntegrationHost;
  store: SyncStore;
  runner: AdapterRunner;
  gate: PauseGate;
  events: EventLog;
  redact(text: string): string;
};

const TRANSIENT = new Set(["REMOTE_UNAVAILABLE", "TIMEOUT", "RATE_LIMITED", "COMPONENT_CRASHED"]);
const UNKNOWN_OUTCOME = new Set(["REMOTE_UNAVAILABLE", "TIMEOUT", "COMPONENT_CRASHED", "INTERNAL"]);
export const backoffMs = (attempts: number) => Math.min(5_000 * 2 ** Math.max(0, attempts - 1), 30 * 60_000);
export const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
export const asKibo = (e: unknown) =>
  e instanceof KiboError ? e : new KiboError("INTERNAL", e instanceof Error ? e.message : String(e));

type Target = {
  projectId: string;
  b: Binding;
  row: OutboxRow;
  wasUncertain: boolean;
  ticket: TicketView;
  report: SyncReport;
};

export function createFlusher(deps: EngineDeps) {
  const { host, store, runner, gate, events, redact } = deps;
  const ticketOf = (projectId: string, id: string): TicketView | undefined =>
    host.snapshot(projectId).tickets.find((t) => t.id === id);

  const pushCreate = async ({ projectId, b, row, wasUncertain, ticket, report }: Target) => {
    const m = await runner.push(projectId, b, {
      kind: "create",
      ticketId: ticket.id,
      fields: {
        title: ticket.title.trim(),
        description: ticket.description,
        statusId: ticket.statusId,
        closed: ticket.statusId === "done",
      },
      since: wasUncertain ? row.firstAttemptAt : null,
    });
    host.transaction(() => {
      const fresh = ticketOf(projectId, ticket.id);
      const item = {
        bindingId: b.id,
        remoteId: m.remoteId,
        ticketId: ticket.id,
        base: m.fields,
        remoteUpdatedAt: m.updatedAt,
        lastPushedHash: fieldsHash(m.fields),
      };
      store.deleteOutbox(row.id);
      if (!fresh) return store.upsertItem({ ...item, ticketId: IGNORED });
      host.command(projectId, { method: "upsertExternalRef", ticketId: ticket.id, ref: m.ref }, SYNC);
      store.upsertItem(item);
      if (JSON.stringify(projectLocal(fresh, m.fields, statusMapOf(b))) !== JSON.stringify(m.fields)) {
        store.enqueue({ bindingId: b.id, projectId, ticketId: ticket.id, op: "update" }, host.now());
      }
    });
    report.pushed += 1;
  };

  const pushUpdate = async ({ projectId, b, row, ticket, report }: Target) => {
    const item = store.itemByTicket(b.id, ticket.id);
    if (!item) return store.deleteOutbox(row.id);
    const map = statusMapOf(b);
    const { push } = planSync({
      base: item.base,
      local: projectLocal(ticket, item.base, map),
      remote: item.base,
    });
    const pushed = SYNCED_FIELDS.filter((f) => push[f] !== undefined);
    if (pushed.length === 0) return store.deleteOutbox(row.id);
    const m = await runner.push(projectId, b, { kind: "update", remoteId: item.remoteId, patch: push });
    host.transaction(() => {
      store.deleteOutbox(row.id);
      const fresh = ticketOf(projectId, ticket.id);
      if (!fresh) return;
      const local = projectLocal(fresh, item.base, map);
      const settle = settleAfterPush({ base: item.base, pushed, returned: m.fields, local });
      applyPlan(deps, projectId, fresh, settle.apply);
      store.upsertItem({
        ...item,
        base: settle.nextBase,
        remoteUpdatedAt: m.updatedAt,
        lastPushedHash: fieldsHash(m.fields),
      });
      if (Object.keys(settle.push).length > 0)
        store.enqueue({ bindingId: b.id, projectId, ticketId: ticket.id, op: "update" }, host.now());
    });
    report.pushed += 1;
  };

  const breakLink = ({ projectId, b, row, ticket }: Target) => {
    const ref = ticket.externalRefs.find((r) => r.kind === "github_issue" && r.bindingId === b.id);
    host.transaction(() => {
      if (ref?.kind === "github_issue")
        host.command(
          projectId,
          { method: "upsertExternalRef", ticketId: ticket.id, ref: { ...ref, url: null } },
          SYNC,
        );
      const item = store.itemByTicket(b.id, ticket.id);
      if (item) store.upsertItem({ ...item, ticketId: IGNORED });
      store.deleteOutbox(row.id);
    });
    events.log("github-issues", "warn", `${ticket.key}: issue deleted or transferred, link broken`);
  };

  const onPushError = (t: Target, e: KiboError): "stop" | "next" => {
    const row = { ...t.row, uncertain: UNKNOWN_OUTCOME.has(e.code) ? t.row.uncertain : t.wasUncertain };
    if (TRANSIENT.has(e.code)) {
      store.attempt(row.id, { ...row, nextAttemptAt: host.now() + backoffMs(row.attempts), lastError: null });
      return "stop";
    }
    if (e.code === "REMOTE_NOT_FOUND" && row.op === "update") {
      breakLink(t);
      return "next";
    }
    if (e.code === "REMOTE_CONFLICT" && row.attempts <= 1) {
      store.attempt(row.id, { ...row, nextAttemptAt: host.now(), lastError: null });
      return "stop";
    }
    store.attempt(row.id, {
      ...row,
      nextAttemptAt: null,
      lastError: { code: e.code, message: redact(e.detail) },
    });
    events.log("github-issues", "error", `${t.ticket.key}: ${e.detail}`);
    return "stop";
  };

  return async function flushBinding(projectId: string, b: Binding, report: SyncReport): Promise<void> {
    for (;;) {
      if (gate.blockedUntil() !== null) return;
      const head = store.head(b.id, host.now());
      if (!head) return;
      const ticket = ticketOf(projectId, head.ticketId);
      if (!ticket) {
        store.deleteOutbox(head.id);
        continue;
      }
      const creates = head.op === "create" && store.itemByTicket(b.id, ticket.id) === null;
      const row = {
        ...head,
        attempts: head.attempts + 1,
        firstAttemptAt: head.firstAttemptAt ?? iso(host.now()),
        uncertain: head.uncertain || creates,
      };
      store.attempt(row.id, row);
      const target = { projectId, b, row, wasUncertain: head.uncertain, ticket, report };
      try {
        if (creates) await pushCreate(target);
        else await pushUpdate(target);
      } catch (e) {
        if (onPushError(target, asKibo(e)) === "stop") return;
      }
    }
  };
}
