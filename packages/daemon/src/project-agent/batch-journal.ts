import type { Batch, BatchEvent, ProjectEventInput, ProjectEventSink, RunView } from "@kibo/schema";

export type BatchJournalPort = {
  proposed(batch: Batch): void;
  appended(batch: Batch, event: BatchEvent): void;
};
export type BatchJournal = BatchJournalPort & { close(): void };

type BatchJournalDeps = {
  events: ProjectEventSink;
  turnOf(runId: string): number | null;
  onRunState(listener: (run: Pick<RunView, "id" | "state">) => void): () => void;
};

type Held = { batch: Batch; turn: number | null };

const lotEvent = (kind: ProjectEventInput["kind"], data: ProjectEventInput["data"]): ProjectEventInput => ({
  kind,
  ticketId: null,
  featureId: null,
  source: "project-agent",
  data,
});

export function createBatchJournal(deps: BatchJournalDeps): BatchJournal {
  const held = new Map<string, Held>();
  let off: (() => void) | null = null;
  const flush = (runId: string): void => {
    const draft = held.get(runId);
    if (!draft) return;
    held.delete(runId);
    const { batch } = draft;
    deps.events.record(
      batch.projectId,
      lotEvent("batch_proposed", { seq: batch.seq, actions: batch.actions.length }),
    );
  };
  const watch = (): void => {
    off ??= deps.onRunState((run) => {
      if (run.state !== "running") flush(run.id);
    });
  };
  return {
    proposed(batch) {
      watch();
      const turn = deps.turnOf(batch.runId);
      if (held.get(batch.runId)?.turn !== turn) flush(batch.runId);
      held.set(batch.runId, { batch, turn });
    },
    appended(batch, event) {
      if (event.type !== "decided") return;
      if (held.get(batch.runId)?.batch.id === batch.id) flush(batch.runId);
      const actions = event.actionIds?.length ?? batch.actions.length;
      deps.events.record(
        batch.projectId,
        lotEvent("batch_decided", { seq: batch.seq, decision: event.decision, actions }),
      );
    },
    close() {
      off?.();
      off = null;
    },
  };
}
