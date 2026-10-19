import type { RunQuestions, RunView } from "@kibo/schema";
import { firstOpenQuestion, QuestionPreview } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { MessageCircleQuestion } from "lucide-react";
import { frRunChat } from "../i18n/fr-run-chat";
import { useProject } from "../state/use-projects";
import { useOpenQuestions } from "./open-questions";

type Props = { run: RunView; questions: RunQuestions | null };

export function RunQuestionsBar({ run, questions }: Props) {
  const openQuestions = useOpenQuestions();
  const project = useProject(run.ticketId === null ? null : run.projectId);
  const open = questions?.open ?? 0;
  const { projectId, ticketId } = run;
  if (open === 0) return null;
  const first = project && ticketId ? firstOpenQuestion(project.questions, ticketId) : null;
  const show = (questionId: string | null) => {
    if (openQuestions && projectId) openQuestions(projectId, questionId ?? undefined);
  };
  const label = <span className="text-orange-600 dark:text-orange-400">{frRunChat.openQuestions(open)}</span>;
  return (
    <div className="grid gap-1 text-xs">
      <p className="flex items-center gap-2">
        <MessageCircleQuestion aria-hidden className="size-3.5 text-orange-600 dark:text-orange-400" />
        {project && ticketId ? (
          <QuestionPreview
            mode="ticket"
            questions={project.questions}
            recipients={project.questionRecipients}
            ticket={{ id: ticketId, keyLabel: run.ticketKey ?? "", title: run.ticketTitle ?? "" }}
            runLabel={(runId) => (runId === run.id ? run.label : runId)}
            onOpen={show}
          >
            <button type="button" className="rounded-sm hover:underline" onClick={() => show(first)}>
              {label}
            </button>
          </QuestionPreview>
        ) : (
          label
        )}
        {openQuestions && projectId && (
          <Button size="sm" variant="link" className="h-6 px-0" onClick={() => show(first)}>
            {frRunChat.openQuestionsLink}
          </Button>
        )}
      </p>
    </div>
  );
}
