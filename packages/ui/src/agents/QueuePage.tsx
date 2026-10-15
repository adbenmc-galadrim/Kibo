import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  type AgentSummary,
  type AgentsState,
  keyBesideLabel,
  machineLocks,
  machineLocksDir,
  type ProjectSummary,
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
import { frAgentsSkills } from "../i18n/fr-agents-skills";
import { projectName, scopeText } from "./catalog/agent-labels";
import { useAgentList } from "./catalog/use-agent-list";
import { elapsed, formatDuration } from "./format";
import { MachineLocks } from "./MachineLocks";
import { Mention } from "./mention/Mention";
import { ProjectFilter } from "./ProjectFilter";
import { effectiveProject, projectRuns } from "./project-filter";
import { useAgentsProject } from "./project-pref";
import { QueueCapacity } from "./QueueCapacity";
import { QueueItem } from "./QueueItem";
import {
  byStart,
  holdsSlot,
  orderAgents,
  queueNeighbours,
  type SubagentSlot,
  subagentsByType,
} from "./queue-runs";
import { SlotMeter } from "./SlotMeter";

type Props = {
  state: AgentsState;
  projects: ProjectSummary[];
  now: number;
  onAnswer: (runId: string) => void;
};
type BoardProps = Props & { agents: AgentSummary[] };

const q = frAgentsSkills.queue;

function columnLabel(agent: AgentSummary, projects: readonly ProjectSummary[]): string {
  const scope =
    agent.scope === "project" ? projectName(agent.projectId, projects) : scopeText(agent, projects);
  return q.column(agent.name, scope);
}

export function moveTarget(queue: QueueEntry[], activeId: string, overId: string | null): number | null {
  if (!overId || overId === activeId) return null;
  const index = queue.findIndex((q) => q.runId === overId);
  return index >= 0 ? index : null;
}

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="truncate text-3xs font-medium uppercase tracking-wide text-muted-foreground">{children}</p>
  );
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
      <Mention runId={run.id} label={run.label} className="max-w-[60%]" />
      <span className="min-w-0 flex-1 truncate">{text ?? runSubject(run)}</span>
      <span className="font-mono text-3xs text-muted-foreground">
        {formatDuration(since === undefined ? elapsed(run, now) : now - since)}
      </span>
    </li>
  );
}

export function QueuePage(props: Props) {
  const [pref] = useAgentsProject();
  const project = effectiveProject(pref, props.projects);
  const list = useAgentList(project?.id ?? null);
  const agents = (list.agents ?? []).filter(
    (a) => a.shadowedBy === null && (project === null || a.scope !== "project" || a.projectId === project.id),
  );
  return <QueueBoard {...props} agents={agents} />;
}

export function QueueBoard({ state, agents, projects, now, onAnswer }: BoardProps) {
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
  const [pref, setPref] = useAgentsProject();
  const project = effectiveProject(pref, projects);
  const runs = projectRuns(state.runs, project?.id ?? null);
  const runIds = new Set(runs.map((r) => r.id));
  const visibleQueue = state.queue.filter((q) => runIds.has(q.runId));
  const byId = new Map(runs.map((r) => [r.id, r]));
  const queued = visibleQueue.flatMap((entry) => {
    const run = byId.get(entry.runId);
    return run ? [{ run, entry }] : [];
  });
  const subagents = subagentsByType(state, runs);
  const agentNames = new Set(agents.map((p) => p.name));
  const waiting = runs.filter((r) => r.state === "waiting_input");
  const onDragEnd = (e: DragEndEvent) => {
    const runId = String(e.active.id);
    const index = moveTarget(state.queue, runId, e.over ? String(e.over.id) : null);
    if (index !== null) void act({ method: "moveRun", runId, index });
  };
  return (
    <div className="grid content-start gap-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        {project && <p className="text-xs text-muted-foreground">{frAgentsPage.project.globalHint}</p>}
        <span className="flex-1" />
        <ProjectFilter projects={projects} value={pref} onChange={setPref} />
      </div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {q.failed}
        </p>
      )}
      <QueueCapacity
        state={state}
        now={now}
        onSlots={(hostSlots) => void act({ method: "setHost", patch: { hostSlots } })}
      />
      <h2 className="text-md font-semibold">{q.byAgent}</h2>
      <DndContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
          {orderAgents(agents, runs, visibleQueue).map((p) => {
            const running = runs.filter((r) => r.profileId === p.ref && holdsSlot(r)).sort(byStart);
            const slotsUsed = state.runs.filter((r) => r.profileId === p.ref && holdsSlot(r)).length;
            const mine = queued.filter(({ run }) => run.profileId === p.ref);
            const subs = subagents.get(p.name) ?? [];
            return (
              <Column
                key={p.ref}
                label={columnLabel(p, projects)}
                aside={
                  <span className="flex items-center gap-1.5 font-mono text-2xs">
                    <SlotMeter used={slotsUsed} total={p.settings.maxParallel} />
                    {`${slotsUsed}/${p.settings.maxParallel}`}
                  </span>
                }
              >
                <Label>{q.running}</Label>
                {running.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{q.empty}</p>
                ) : (
                  <ul className="grid grid-cols-1 gap-1.5">
                    {running.map((r) => (
                      <RunLine key={r.id} run={r} now={now} />
                    ))}
                  </ul>
                )}
                <Label>{q.queued}</Label>
                {mine.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{q.empty}</p>
                ) : (
                  <ul className="grid grid-cols-1 gap-1.5">
                    {mine.map(({ run, entry }) => (
                      <QueueItem
                        key={run.id}
                        run={run}
                        entry={entry}
                        {...queueNeighbours(visibleQueue, run.id)}
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
                    <Label>{q.subagent}</Label>
                    <SubagentSlots items={subs} now={now} />
                  </>
                )}
              </Column>
            );
          })}
          {[...subagents]
            .filter(([type]) => !agentNames.has(type))
            .map(([type, items]) => (
              <Column
                key={type}
                label={type}
                aside={<span className="text-2xs text-muted-foreground">{q.subagent}</span>}
              >
                <SubagentSlots items={items} now={now} />
              </Column>
            ))}
          <section
            aria-label={q.waiting}
            className="grid min-w-0 grid-cols-1 content-start gap-2 rounded-lg border bg-card p-3"
          >
            <header className="flex items-center gap-2 text-sm font-semibold">
              <Bell aria-hidden className="size-4 text-amber-500" />
              {q.waiting}
            </header>
            <p className="text-2xs text-muted-foreground">{q.waitingHelp}</p>
            {waiting.map((r) => (
              <div
                key={r.id}
                className="grid min-w-0 grid-cols-1 gap-2 rounded-md border border-amber-400 bg-amber-50 p-3 dark:border-amber-600/70 dark:bg-amber-500/10"
              >
                <span className="flex min-w-0 items-center gap-1 text-xs">
                  <Mention runId={r.id} label={r.label} />
                  {keyBesideLabel(r.label, r.ticketKey) && (
                    <span className="font-mono">{`· ${r.ticketKey}`}</span>
                  )}
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
      <MachineLocks locks={machineLocks(state)} now={now} dir={machineLocksDir(state)} />
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
        describeError={() => q.failed}
      />
    </div>
  );
}

function SubagentSlots({ items, now }: { items: SubagentSlot[]; now: number }) {
  return (
    <>
      {items.map(({ parent, sub }) => (
        <div key={sub.id} className="grid min-w-0 grid-cols-1 gap-1.5">
          <Label>{q.inSlotOf(parent.label)}</Label>
          <ul>
            <RunLine run={parent} text={sub.description || undefined} now={now} since={sub.startedAt} />
          </ul>
        </div>
      ))}
      <p className="text-2xs text-muted-foreground">{q.subagentHelp}</p>
    </>
  );
}
