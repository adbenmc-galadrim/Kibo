import { type Binding, KiboError, type SyncReport, type SyncState } from "@kibo/schema";
import { applyRemote } from "./apply";
import { asKibo, createFlusher, type EngineDeps, iso } from "./push";
import type { CursorRow } from "./sync-store";

export { backoffMs, type PauseGate } from "./push";

export type SyncEngine = {
  cycle(projectId: string, bindingId: string): Promise<SyncReport>;
  flush(projectId: string, bindingId: string): Promise<void>;
  state(projectId: string): SyncState;
  resolveOutbox(projectId: string, outboxId: number, action: "retry" | "drop"): void;
  deleteBinding(projectId: string, bindingId: string): Promise<void>;
  runnable(): { projectId: string; bindingId: string }[];
};

const MAX_PAGES = 50;
const emptyReport = (): SyncReport => ({ pulled: 0, created: 0, updated: 0, pushed: 0, conflicts: 0 });

export function createSyncEngine(deps: EngineDeps): SyncEngine {
  const { host, store, runner, gate, events, redact } = deps;
  const flushBinding = createFlusher(deps);
  const running = new Map<string, Promise<unknown>>();
  const waitingCycles = new Map<string, Promise<SyncReport>>();
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

  const pullBinding = async (projectId: string, b: Binding, report: SyncReport) => {
    const prev = cursorOf(projectId, b);
    const until = gate.blockedUntil();
    if (until !== null) throw new KiboError("RATE_LIMITED", `github paused until ${iso(until)}`);
    const allowImport = !store.uncertainCreate(b.id);
    const kept = (cursor: string | null) => (allowImport ? cursor : prev.cursor);
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
      store.saveCursor({ ...prev, cursor: kept(cursor), imported });
      host.broadcast({ type: "sync", projectId, bindingId: b.id, imported, running: true });
      if (!res.more) break;
    }
    store.saveCursor({ ...prev, cursor: kept(cursor), imported, lastPullAt: host.now(), lastError: null });
  };

  const recordCycleError = (projectId: string, bindingId: string, b: Binding | null, e: KiboError) => {
    if (b)
      store.saveCursor({ ...cursorOf(projectId, b), lastError: { code: e.code, message: redact(e.detail) } });
    const level = e.code === "RATE_LIMITED" ? "warn" : "error";
    events.log("github-issues", level, `sync ${b?.config.repo ?? bindingId}: ${e.detail}`);
  };

  const runCycle = async (projectId: string, bindingId: string): Promise<SyncReport> => {
    const report = emptyReport();
    let b: Binding | null = null;
    try {
      b = bindingOf(projectId, bindingId);
      await flushBinding(projectId, b, report);
      await pullBinding(projectId, b, report);
      await flushBinding(projectId, b, report);
      return report;
    } catch (e) {
      const k = asKibo(e);
      recordCycleError(projectId, bindingId, b, k);
      throw k;
    } finally {
      const imported = store.cursor(bindingId)?.imported ?? 0;
      host.broadcast({ type: "sync", projectId, bindingId, imported, running: false });
    }
  };

  return {
    cycle(projectId, bindingId) {
      const waiting = waitingCycles.get(bindingId);
      if (waiting) return waiting;
      const next = single(bindingId, () => {
        waitingCycles.delete(bindingId);
        return runCycle(projectId, bindingId);
      });
      waitingCycles.set(bindingId, next);
      return next;
    },
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
    deleteBinding: (projectId, bindingId) =>
      single(bindingId, async () => {
        host.transaction(() => {
          host.command(
            projectId,
            { method: "removeBinding", bindingId },
            { origin: "user", instanceId: null },
          );
          store.dropBinding(bindingId);
        });
      }),
    runnable: () =>
      host.projects().flatMap((p) =>
        host
          .snapshot(p.id)
          .bindings.filter((b) => b.runner === host.user)
          .map((b) => ({ projectId: p.id, bindingId: b.id })),
      ),
  };
}
