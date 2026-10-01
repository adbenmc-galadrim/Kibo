import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  type ActiveSubagent,
  type AgentProfile,
  type AgentsState,
  type QueueEntry,
  type RpcRequest,
  type RunView,
  runSubject,
} from "@kibo/schema";
import { RunDot } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { Bell, Bot } from "lucide-react";
import { type ReactNode, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { elapsed, formatDuration } from "./format";
import { QueueCapacity } from "./QueueCapacity";
import { QueueItem } from "./QueueItem";
import { byStart, holdsSlot, orderProfiles } from "./queue-runs";
import { SlotMeter } from "./SlotMeter";

type Props = { state: AgentsState; profiles: AgentProfile[]; now: number; onAnswer: (runId: string) => void };

export function moveTarget(queue: QueueEntry[], activeId: string, overId: string | null): number | null {
  if (!overId || overId === activeId) return null;
  const index = queue.findIndex((q) => q.runId === overId);
  return index >= 0 ? index : null;
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-3xs font-medium uppercase tracking-wide text-muted-foreground">{children}</p>;
}

function Column({ label, aside, children }: { label: string; aside: ReactNode; children: ReactNode }) {
  return (
    <section
      aria-label={label}
      className="grid min-w-0 grid-cols-1 content-start gap-2 rounded-lg border bg-card p-3"
    >
      <header className="flex items-center gap-2">
        <Bot aria-hidden className="size-4" />
        <span className="font-mono text-sm font-semibold">{label}</span>
        <span className="flex-1" />
        {aside}
      </header>
      {children}
    </section>
  );
}

function RunLine({ run, text, now, since }: { run: RunView; text?: string; now: number; since?: number }) {
  return (
    <li className="flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
      <RunDot state={run.state} />
      <span className="min-w-0 flex-1 truncate">{text ?? runSubject(run)}</span>
      <span className="font-mono text-3xs text-muted-foreground">
        {formatDuration(since === undefined ? elapsed(run, now) : now - since)}
      </span>
    </li>
  );
}

export function QueuePage({ state, profiles, now, onAnswer }: Props) {
  const [failed, setFailed] = useState(false);
  const [cancelling, setCancelling] = useState<RunView | null>(null);
  const act = async (req: RpcRequest) => {
    setFailed(false);
    try {
      await client.rpc(req);
    } catch {
      setFailed(true);
    }
  };
  const byId = new Map(state.runs.map((r) => [r.id, r]));
  const queued = state.queue.flatMap((entry) => {
    const run = byId.get(entry.runId);
    return run ? [{ run, entry }] : [];
  });
  const subagents = new Map<string, { parent: RunView; sub: ActiveSubagent }[]>();
  for (const parent of state.runs.filter(holdsSlot).sort(byStart)) {
    for (const sub of parent.subagents)
      subagents.set(sub.type, [...(subagents.get(sub.type) ?? []), { parent, sub }]);
  }
  const profileNames = new Set(profiles.map((p) => p.name));
  const waiting = state.runs.filter((r) => r.state === "waiting_input");
  const onDragEnd = (e: DragEndEvent) => {
    const runId = String(e.active.id);
    const index = moveTarget(state.queue, runId, e.over ? String(e.over.id) : null);
    if (index !== null) void act({ method: "moveRun", runId, index });
  };
  return (
    <div className="grid content-start gap-6 p-6">
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {fr.queue.failed}
        </p>
      )}
      <QueueCapacity
        state={state}
        now={now}
        onSlots={(hostSlots) => void act({ method: "setHost", patch: { hostSlots } })}
      />
      <h2 className="text-md font-semibold">{fr.queue.byProfile}</h2>
      <DndContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
          {orderProfiles(profiles, state.runs, state.queue).map((p) => {
            const running = state.runs.filter((r) => r.profileId === p.id && holdsSlot(r)).sort(byStart);
            const mine = queued.filter(({ run }) => run.profileId === p.id);
            const subs = subagents.get(p.name) ?? [];
            return (
              <Column
                key={p.id}
                label={p.name}
                aside={
                  <span className="flex items-center gap-1.5 font-mono text-2xs">
                    <SlotMeter used={running.length} total={p.maxParallel} />
                    {`${running.length}/${p.maxParallel}`}
                  </span>
                }
              >
                <Label>{fr.queue.running}</Label>
                {running.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{fr.queue.empty}</p>
                ) : (
                  <ul className="grid grid-cols-1 gap-1.5">
                    {running.map((r) => (
                      <RunLine key={r.id} run={r} now={now} />
                    ))}
                  </ul>
                )}
                <Label>{fr.queue.queued}</Label>
                {mine.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{fr.queue.empty}</p>
                ) : (
                  <ul className="grid grid-cols-1 gap-1.5">
                    {mine.map(({ run, entry }) => (
                      <QueueItem
                        key={run.id}
                        run={run}
                        entry={entry}
                        count={state.queue.length}
                        onMove={(index) => void act({ method: "moveRun", runId: run.id, index })}
                        onPriority={(priority) =>
                          void act({ method: "setRunPriority", runId: run.id, priority })
                        }
                        onCancel={() => setCancelling(run)}
                      />
                    ))}
                  </ul>
                )}
                {subs.length > 0 && (
                  <>
                    <Label>{fr.queue.subagent}</Label>
                    <SubagentSlots items={subs} now={now} />
                  </>
                )}
              </Column>
            );
          })}
          {[...subagents]
            .filter(([type]) => !profileNames.has(type))
            .map(([type, items]) => (
              <Column
                key={type}
                label={type}
                aside={<span className="text-2xs text-muted-foreground">{fr.queue.subagent}</span>}
              >
                <SubagentSlots items={items} now={now} />
              </Column>
            ))}
          <section
            aria-label={fr.queue.waiting}
            className="grid min-w-0 grid-cols-1 content-start gap-2 rounded-lg border bg-card p-3"
          >
            <header className="flex items-center gap-2 text-sm font-semibold">
              <Bell aria-hidden className="size-4 text-amber-500" />
              {fr.queue.waiting}
            </header>
            <p className="text-2xs text-muted-foreground">{fr.queue.waitingHelp}</p>
            {waiting.map((r) => (
              <div
                key={r.id}
                className="grid gap-2 rounded-md border border-amber-400 bg-amber-50 p-3 dark:border-amber-600/70 dark:bg-amber-500/10"
              >
                <span className="font-mono text-xs">
                  {[r.label, r.ticketKey].filter(Boolean).join(" · ")}
                </span>
                {r.question && <p className="text-2xs text-muted-foreground">{`« ${r.question} »`}</p>}
                <Button
                  size="sm"
                  className="w-fit bg-brand-strong text-white hover:bg-brand-strong/90"
                  aria-label={fr.agents.answerTo(r.label)}
                  onClick={() => onAnswer(r.id)}
                >
                  {fr.agents.answer}
                </Button>
              </div>
            ))}
          </section>
        </div>
      </DndContext>
      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={frAgentsPage.cancelTitle(cancelling?.ticketKey ?? cancelling?.ticketTitle ?? "")}
        description={frAgentsPage.cancelHelp}
        confirmLabel={frAgentsPage.cancelConfirm}
        cancelLabel={fr.common.cancel}
        onConfirm={async () => {
          if (cancelling) await client.rpc({ method: "cancelRun", runId: cancelling.id });
        }}
        describeError={() => fr.queue.failed}
      />
    </div>
  );
}

function SubagentSlots({ items, now }: { items: { parent: RunView; sub: ActiveSubagent }[]; now: number }) {
  return (
    <>
      {items.map(({ parent, sub }) => (
        <div key={sub.id} className="grid gap-1.5">
          <Label>{fr.queue.inSlotOf(parent.label)}</Label>
          <ul>
            <RunLine run={parent} now={now} since={sub.since} />
          </ul>
        </div>
      ))}
      <p className="text-2xs text-muted-foreground">{fr.queue.subagentHelp}</p>
    </>
  );
}
