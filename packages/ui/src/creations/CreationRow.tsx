import { type AgentsState, type ComponentDraft, isTerminal, type RunState } from "@kibo/schema";
import { RUN_TEXT } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { TableCell, TableRow } from "@kibo/sdk/ui/table";
import { useId, useState } from "react";
import { journalUnavailable, RunJournal } from "../agents/RunJournal";
import { draftStep } from "../ai/draft-flow";
import { fr } from "../i18n/fr";
import { frCreations } from "../i18n/fr-creations";
import { relativeTime } from "../lib/relative-time";
import { isActiveDraft } from "../state/draft-activity";
import { useRunLog } from "../state/use-run-log";
import { type RunStatus, runStatus } from "./creation-status";

const t = frCreations.row;
const CELL = "px-4 py-3 align-top";
const COLUMNS = 5;

const RUN_STATE: Record<RunStatus["kind"], RunState> = {
  queued: "queued",
  running: "running",
  waiting: "waiting_input",
};

const runText = (s: RunStatus): string =>
  s.kind === "queued" ? t.queued(s.position) : s.kind === "running" ? t.running : t.waiting;

function stepText(draft: ComponentDraft): string {
  const step = draftStep(draft);
  return fr.ai.stepLabel(step, fr.ai.steps[step - 1] ?? "");
}

function Progress({ draft, agents }: { draft: ComponentDraft; agents: AgentsState | null }) {
  if (!isActiveDraft(draft)) return <span>{draft.status === "done" ? t.published : t.abandoned}</span>;
  const run = runStatus(draft, agents);
  const counts = [t.attempts(draft.attempts), ...(draft.revisions > 0 ? [t.revisions(draft.revisions)] : [])];
  return (
    <span className="grid gap-0.5">
      <span>
        {stepText(draft)}
        {run && <span className={RUN_TEXT[RUN_STATE[run.kind]]}>{` · ${runText(run)}`}</span>}
      </span>
      <span className="text-muted-foreground">{counts.join(" · ")}</span>
    </span>
  );
}

function Journal({ draft, agents, id }: { draft: ComponentDraft; agents: AgentsState | null; id: string }) {
  const log = useRunLog(draft.runId);
  const state = agents?.runs.find((r) => r.id === draft.runId)?.state;
  const ended = !isActiveDraft(draft) || (state === undefined ? agents !== null : isTerminal(state));
  return (
    <TableRow id={id} className="hover:bg-transparent">
      <TableCell colSpan={COLUMNS} className="h-56 px-4 pb-3">
        <div className="flex h-full min-h-0 flex-col">
          <RunJournal
            label={draft.title}
            log={log.log ?? []}
            missing={journalUnavailable(log, ended)}
            files={null}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

type Props = {
  draft: ComponentDraft;
  agents: AgentsState | null;
  now: number;
  onOpen(draft: ComponentDraft): void;
  onAbandon(draft: ComponentDraft): void;
};

export function CreationRow({ draft, agents, now, onOpen, onAbandon }: Props) {
  const journalId = useId();
  const [journal, setJournal] = useState(false);
  const active = isActiveDraft(draft);
  return (
    <>
      <TableRow>
        <TableCell className={CELL}>
          <span className="grid gap-0.5">
            <span className="font-medium">{draft.title}</span>
            <span className="font-mono text-muted-foreground">{draft.componentId}</span>
          </span>
        </TableCell>
        <TableCell className={CELL}>{t.modes[draft.mode]}</TableCell>
        <TableCell className={CELL}>
          <Progress draft={draft} agents={agents} />
        </TableCell>
        <TableCell className={`${CELL} text-muted-foreground`}>
          {relativeTime(draft.updatedAt, now)}
        </TableCell>
        <TableCell className={CELL}>
          <span className="flex flex-wrap justify-end gap-1.5">
            {active && (
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                aria-label={t.openLabel(draft.title)}
                onClick={() => onOpen(draft)}
              >
                {t.open}
              </Button>
            )}
            {draft.runId && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                aria-label={t.journalLabel(draft.title)}
                aria-expanded={journal}
                aria-controls={journal ? journalId : undefined}
                onClick={() => setJournal((v) => !v)}
              >
                {t.journal}
              </Button>
            )}
            {active && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                aria-label={t.abandonLabel(draft.title)}
                onClick={() => onAbandon(draft)}
              >
                {t.abandon}
              </Button>
            )}
          </span>
        </TableCell>
      </TableRow>
      {journal && <Journal draft={draft} agents={agents} id={journalId} />}
    </>
  );
}
