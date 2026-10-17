import type { Batch, BatchEvent, ProjectEventInput, ProjectEventSink } from "@kibo/schema";

const lotEvent = (kind: ProjectEventInput["kind"], data: ProjectEventInput["data"]): ProjectEventInput => ({
  kind,
  ticketId: null,
  featureId: null,
  source: "project-agent",
  data,
});

export function journalProposed(events: ProjectEventSink | undefined, batch: Batch): void {
  events?.record(
    batch.projectId,
    lotEvent("batch_proposed", { seq: batch.seq, actions: batch.actions.length }),
  );
}

export function journalDecided(events: ProjectEventSink | undefined, batch: Batch, event: BatchEvent): void {
  if (event.type !== "decided") return;
  const actions = event.actionIds?.length ?? batch.actions.length;
  events?.record(
    batch.projectId,
    lotEvent("batch_decided", { seq: batch.seq, decision: event.decision, actions }),
  );
}
