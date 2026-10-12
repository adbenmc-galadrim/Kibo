import { isTerminal, type RunQuestions, type RunView, runSubject } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { Bot, Square } from "lucide-react";
import { type ReactNode, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { frRunChat } from "../i18n/fr-run-chat";
import { isDemoAgent } from "./assignable";
import { elapsed, formatDuration, workspaceText } from "./format";
import { ReplyBox } from "./ReplyBox";
import { ReviewButton } from "./ReviewButton";
import { RunQuestionsBar } from "./RunQuestionsBar";
import { chatBox } from "./run-chat";

type DetailProps = {
  run: RunView;
  resumable: boolean;
  questions: RunQuestions | null;
  now: number;
  children: ReactNode;
};

export function RunStop({ run }: { run: RunView }) {
  const [stopping, setStopping] = useState(false);
  const stop = async () => {
    await client.rpc({ method: "cancelRun", runId: run.id });
  };
  if (isTerminal(run.state)) return null;
  return (
    <>
      <Button size="sm" variant="ghost" className="h-7" onClick={() => setStopping(true)}>
        <Square className="size-3" />
        {fr.agents.stop}
      </Button>
      <ConfirmDialog
        open={stopping}
        onOpenChange={setStopping}
        title={frAgentsPage.stopTitle(run.label)}
        description={frAgentsPage.stopHelp}
        confirmLabel={frAgentsPage.stopConfirm}
        cancelLabel={fr.common.cancel}
        onConfirm={stop}
        describeError={() => fr.agents.stopFailed}
      />
    </>
  );
}

type ReplyProps = Pick<DetailProps, "run" | "resumable" | "questions">;

export function RunReply({ run, resumable, questions }: ReplyProps) {
  const box = chatBox(run, resumable);
  return (
    <>
      <RunQuestionsBar run={run} questions={questions} />
      {box && (
        <ReplyBox
          key={box.mode}
          run={run}
          mode={box.mode}
          pending={box.pending}
          title={box.mode === "answer" ? frRunChat.answerTitle : frRunChat.writeTitle}
        />
      )}
    </>
  );
}

export function RunDetail({ run, resumable, questions, now, children }: DetailProps) {
  const where = [workspaceText(run.workspace), formatDuration(elapsed(run, now))].filter(Boolean).join(" · ");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <Bot aria-hidden className="size-4 shrink-0 text-brand" />
        <span className="min-w-0 truncate font-mono font-semibold">{run.label}</span>
        <span className="min-w-0 truncate text-muted-foreground">{runSubject(run)}</span>
        {isDemoAgent({ ref: run.profileId }) && (
          <span className="shrink-0 text-xs text-brand-strong dark:text-brand">
            {frAgentsPage.demo.option}
          </span>
        )}
        <span className="flex-1" />
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{where}</span>
        <ReviewButton run={run} />
        <RunStop run={run} />
      </div>
      {children}
      <RunReply run={run} resumable={resumable} questions={questions} />
    </div>
  );
}
