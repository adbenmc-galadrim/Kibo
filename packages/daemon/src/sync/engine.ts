import { planSync, projectLocal, SYNCED_FIELDS, settleAfterPush } from "@kibo/core";
import { type Binding, KiboError, type SyncReport, type SyncState, type TicketView } from "@kibo/schema";
import type { EventLog } from "../integrations/events";
import type { AdapterRunner, IntegrationHost } from "../integrations/types";
import { applyPlan, applyRemote, SYNC, statusMapOf } from "./apply";
import { fieldsHash } from "./hash";
import { type CursorRow, IGNORED, type OutboxRow, type SyncStore } from "./sync-store";

export type SyncEngine = {
  cycle(projectId: string, bindingId: string): Promise<SyncReport>;
  flush(projectId: string, bindingId: string): Promise<void>;
  state(projectId: string): SyncState;
  resolveOutbox(projectId: string, outboxId: number, action: "retry" | "drop"): void;
  deleteBinding(projectId: string, bindingId: string): void;
  runnable(): { projectId: string; bindingId: string }[];
};
export type PauseGate = { blockedUntil(): number | null };
type Deps = {
  host: IntegrationHost;
  store: SyncStore;
  runner: AdapterRunner;
  gate: PauseGate;
  events: EventLog;
  redact(text: string): string;
};

const MAX_PAGES = 50;
const TRANSIENT = new Set(["REMOTE_UNAVAILABLE", "TIMEOUT", "RATE_LIMITED", "COMPONENT_CRASHED"]);
export const backoffMs = (attempts: number) => Math.min(5_000 * 2 ** Math.max(0, attempts - 1), 30 * 60_000);
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const asKibo = (e: unknown) =>
  e instanceof KiboError ? e : new KiboError("INTERNAL", e instanceof Error ? e.message : String(e));
const emptyReport = (): SyncReport => ({ pulled: 0, created: 0, updated: 0, pushed: 0, conflicts: 0 });

export function createSyncEngine(deps: Deps): SyncEngine {
  const { host, store, runner, gate, events, redact } = deps;
  const running = new Map<string, Promise<unknown>>();
  const bindingOf = (projectId: string, bindingId: string): Binding => {
    const b = host.snapshot(projectId).bindings.find((x) => x.id === bindingId);
    if (!b) throw new KiboError("NOT_FOUND", `binding ${bindingId} not found`);
    return b;
  };
  const cursorOf = (projectId: string, b: Binding): CursorRow =>
    store.cursor(b.id) ?? {
      bindingId: b.id,
      projectId,
      cursor: null,
      lastPullAt: null,
      lastError: null,
      imported: 0,
    };
  const ticketOf = (projectId: string, id: string): TicketView | undefined =>
    host.snapshot(projectId).tickets.find((t) => t.id === id);
  const single = <T>(bindingId: string, run: () => Promise<T>): Promise<T> => {
    const prev = running.get(bindingId) ?? Promise.resolve();
    const next = prev.then(run, run);
    running.set(bindingId, next);
    const clear = () => {
      if (running.get(bindingId) === next) running.delete(bindingId);
    };
    next.then(clear, clear);
    return next;
  };

  const pushCreate = async (
    projectId: string,
    b: Binding,
    row: OutboxRow,
    ticket: TicketView,
    report: SyncReport,
  ) => {
    const m = await runner.push(projectId, b, {
      kind: "create",
      ticketId: ticket.id,
      fields: {
        title: ticket.title.trim(),
        description: ticket.description,
        statusId: ticket.statusId,
        closed: ticket.statusId === "done",
      },
      since: row.attempts > 1 ? row.firstAttemptAt : null,
    });
    host.transaction(() => {
      host.command(projectId, { method: "upsertExternalRef", ticketId: ticket.id, ref: m.ref }, SYNC);
      store.upsertItem({
        bindingId: b.id,
        remoteId: m.remoteId,
        ticketId: ticket.id,
        base: m.fields,
        remoteUpdatedAt: m.updatedAt,
        lastPushedHash: fieldsHash(m.fields),
      });
      store.deleteOutbox(row.id);
      const fresh = ticketOf(projectId, ticket.id);
      if (
        fresh &&
        JSON.stringify(projectLocal(fresh, m.fields, statusMapOf(b))) !== JSON.stringify(m.fields)
      ) {
        store.enqueue({ bindingId: b.id, projectId, ticketId: ticket.id, op: "update" }, host.now());
      }
    });
    report.pushed += 1;
  };

  const pushUpdate = async (
    projectId: string,
    b: Binding,
    row: OutboxRow,
    ticket: TicketView,
    report: SyncReport,
  ) => {
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
      const settle = settleAfterPush({
        base: item.base,
        pushed,
        returned: m.fields,
        local: projectLocal(fresh, item.base, map),
      });
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

  const onPushError = (
    projectId: string,
    b: Binding,
    row: OutboxRow,
    ticket: TicketView,
    e: KiboError,
  ): "stop" | "next" => {
    if (TRANSIENT.has(e.code)) {
      store.attempt(row.id, { ...row, nextAttemptAt: host.now() + backoffMs(row.attempts), lastError: null });
      return "stop";
    }
    if (e.code === "REMOTE_NOT_FOUND" && row.op === "update") {
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
    events.log("github-issues", "error", `${ticket.key}: ${e.detail}`);
    return "stop";
  };

  const flushBinding = async (projectId: string, b: Binding, report: SyncReport) => {
    for (;;) {
      const row = store.head(b.id, host.now());
      if (!row) return;
      const ticket = ticketOf(projectId, row.ticketId);
      if (!ticket) {
        store.deleteOutbox(row.id);
        continue;
      }
      const attempt = {
        ...row,
        attempts: row.attempts + 1,
        firstAttemptAt: row.firstAttemptAt ?? iso(host.now()),
      };
      store.attempt(row.id, attempt);
      try {
        const known = store.itemByTicket(b.id, ticket.id) !== null;
        if (row.op === "create" && !known) await pushCreate(projectId, b, attempt, ticket, report);
        else await pushUpdate(projectId, b, attempt, ticket, report);
      } catch (e) {
        if (onPushError(projectId, b, attempt, ticket, asKibo(e)) === "stop") return;
      }
    }
  };

  const pullBinding = async (projectId: string, b: Binding, report: SyncReport) => {
    const prev = cursorOf(projectId, b);
    const until = gate.blockedUntil();
    if (until !== null) throw new KiboError("RATE_LIMITED", `github paused until ${iso(until)}`);
    const allowImport = !store.uncertainCreate(b.id);
    let cursor = prev.cursor;
    let imported = prev.imported;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await runner.pull(projectId, b, cursor);
      for (const m of res.items) {
        const r = applyRemote(deps, projectId, b, m, allowImport);
        report.pulled += 1;
        imported += Number(r.created);
        report.created += Number(r.created);
        report.updated += Number(r.updated);
        report.conflicts += r.conflicts.length;
      }
      cursor = res.cursor;
      store.saveCursor({ ...prev, cursor, imported });
      host.broadcast({ type: "sync", projectId, bindingId: b.id, imported, running: true });
      if (!res.more) break;
    }
    store.saveCursor({ ...prev, cursor, imported, lastPullAt: host.now(), lastError: null });
  };

  const recordPullError = (projectId: string, b: Binding, e: KiboError) => {
    const prev = cursorOf(projectId, b);
    store.saveCursor({ ...prev, lastError: { code: e.code, message: redact(e.detail) } });
    events.log(
      "github-issues",
      e.code === "RATE_LIMITED" ? "warn" : "error",
      `pull ${b.config.repo}: ${e.detail}`,
    );
  };

  return {
    cycle: (projectId, bindingId) =>
      single(bindingId, async () => {
        const b = bindingOf(projectId, bindingId);
        const report = emptyReport();
        try {
          await flushBinding(projectId, b, report);
          await pullBinding(projectId, b, report);
          await flushBinding(projectId, b, report);
          return report;
        } catch (e) {
          const k = asKibo(e);
          recordPullError(projectId, b, k);
          throw k;
        } finally {
          const imported = store.cursor(b.id)?.imported ?? 0;
          host.broadcast({ type: "sync", projectId, bindingId, imported, running: false });
        }
      }),
    flush: (projectId, bindingId) =>
      single(bindingId, () => flushBinding(projectId, bindingOf(projectId, bindingId), emptyReport())),
    state(projectId) {
      const snap = host.snapshot(projectId);
      return {
        bindings: snap.bindings.map((b) => {
          const c = store.cursor(b.id);
          return {
            bindingId: b.id,
            repo: b.config.repo,
            runner: b.runner,
            running: running.has(b.id),
            lastPullAt: c?.lastPullAt ?? null,
            lastError: c?.lastError ?? null,
            imported: c?.imported ?? 0,
            resumeAt: gate.blockedUntil(),
          };
        }),
        pending: store.pending(projectId),
        errors: store.errors(projectId),
      };
    },
    resolveOutbox(projectId, outboxId, action) {
      const row = store.row(outboxId);
      if (!row || row.projectId !== projectId || row.lastError === null)
        throw new KiboError("NOT_FOUND", `outbox ${outboxId} has no error`);
      if (action === "drop") return store.deleteOutbox(outboxId);
      store.attempt(outboxId, { ...row, nextAttemptAt: host.now(), lastError: null });
    },
    deleteBinding(projectId, bindingId) {
      host.transaction(() => {
        host.command(projectId, { method: "removeBinding", bindingId }, { origin: "user", instanceId: null });
        store.dropBinding(bindingId);
      });
    },
    runnable: () =>
      host.projects().flatMap((p) =>
        host
          .snapshot(p.id)
          .bindings.filter((b) => b.runner === host.user)
          .map((b) => ({ projectId: p.id, bindingId: b.id })),
      ),
  };
}
