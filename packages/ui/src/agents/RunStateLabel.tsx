import type { RunQuestions, RunView } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { runStateText } from "./format";
import { useOpenQuestions } from "./open-questions";

type Props = {
  run: RunView;
  questions: readonly RunQuestions[];
  position?: number | null;
  clickable?: boolean;
  short?: boolean;
};

const SUFFIX = "text-orange-600 dark:text-orange-400";

export function RunStateLabel({ run, questions, position = null, clickable = false, short = false }: Props) {
  const openQuestions = useOpenQuestions();
  const { text, open } = runStateText(run, questions, position);
  if (open === 0) return <>{short ? fr.agents.states[run.state] : text}</>;
  const count = fr.agents.questionCount(open);
  const { projectId } = run;
  return (
    <>
      {`${fr.agents.states.done} · `}
      {clickable && openQuestions && projectId ? (
        <button
          type="button"
          className={`${SUFFIX} rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          onClick={(e) => {
            e.stopPropagation();
            openQuestions(projectId);
          }}
        >
          {count}
        </button>
      ) : (
        <span className={SUFFIX}>{count}</span>
      )}
    </>
  );
}
