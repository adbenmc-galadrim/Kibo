import {
  type FileRef,
  isTerminal,
  type RunLogEntry,
  type RunView,
  runSubject,
  type Worktree,
} from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { Bot, Square } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { owningWorktree } from "../code/agent-slots";
import { useWorktrees } from "../code/use-worktrees";
import { fr } from "../i18n/fr";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { frRunChat } from "../i18n/fr-run-chat";
import { elapsed, formatDuration, workspaceText } from "./format";
import { ReplyBox } from "./ReplyBox";
import { ReviewButton } from "./ReviewButton";
import { type JournalFiles, RunJournal } from "./RunJournal";
import { chatBox } from "./run-chat";

function journalFiles(
  run: RunView,
  worktrees: Worktree[] | null,
  onOpenFile: (ref: FileRef) => void,
): JournalFiles | null {
  const { projectId, cwd } = run;
  if (!projectId || !cwd || !worktrees || run.workspace === "isolated") return null;
  const worktree = owningWorktree(
    worktrees.map((w) => w.path),
    cwd,
  );
  if (!worktree) return null;
  return {
    worktree,
    ticketKey: run.ticketKey,
    open: (path, line, origin) => onOpenFile({ projectId, worktree, path, line, origin }),
  };
}

type DetailProps = {
  run: RunView;
  resumable: boolean;
  now: number;
  log: RunLogEntry[] | null;
  missing: boolean;
  onOpenFile: (ref: FileRef) => void;
};

export function RunDetail({ run, resumable, now, log, missing, onOpenFile }: DetailProps) {
  const [stopping, setStopping] = useState(false);
  const { worktrees } = useWorktrees(run.cwd && run.workspace !== "isolated" ? run.projectId : null);
  const stop = async () => {
    await client.rpc({ method: "cancelRun", runId: run.id });
  };
  const box = chatBox(run, resumable);
  const where = [workspaceText(run.workspace), formatDuration(elapsed(run, now))].filter(Boolean).join(" · ");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2 text-sm">
        <Bot aria-hidden className="size-4 text-brand" />
        <span className="font-mono font-semibold">{run.label}</span>
        <span className="min-w-0 truncate text-muted-foreground">{runSubject(run)}</span>
        <span className="flex-1" />
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{where}</span>
        <ReviewButton run={run} />
        {!isTerminal(run.state) && (
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setStopping(true)}>
            <Square className="size-3" />
            {fr.agents.stop}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={stopping}
        onOpenChange={setStopping}
        title={frAgentsPage.stopTitle(run.label, run.ticketKey)}
        description={frAgentsPage.stopHelp}
        confirmLabel={frAgentsPage.stopConfirm}
        cancelLabel={fr.common.cancel}
        onConfirm={stop}
        describeError={() => fr.agents.stopFailed}
      />
      <RunJournal
        label={run.label}
        log={log ?? []}
        missing={missing}
        files={journalFiles(run, worktrees, onOpenFile)}
      />
      {box && (
        <ReplyBox
          key={box.mode}
          run={run}
          mode={box.mode}
          busy={box.busy}
          title={box.mode === "answer" ? frRunChat.answerTitle : frRunChat.writeTitle}
        />
      )}
    </div>
  );
}
