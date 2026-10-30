import type { ActionResult, ExpectedState, ProposedAction } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { ArrowRight } from "lucide-react";
import { useId } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import {
  type ActionDiff,
  actionDiffs,
  actionTitle,
  type DiffLabels,
  questionOf,
  replacesContent,
} from "./batch-groups";
import { QuestionText } from "./QuestionText";

type Props = {
  action: ProposedAction;
  expected: ExpectedState | undefined;
  labels: DiffLabels;
  selectable: boolean;
  checked: boolean;
  result: ActionResult | undefined;
  onCheck(checked: boolean): void;
};

const t = frProjectAgent.batch;

const OUTCOME_TONE: Record<ActionResult["outcome"], string> = {
  applied: "text-emerald-700 dark:text-emerald-400",
  stale: "text-amber-700 dark:text-amber-400",
  failed: "text-destructive",
  skipped: "text-muted-foreground",
};

export function Outcome({ result }: { result: ActionResult }) {
  return (
    <p className="flex flex-wrap items-center gap-1 text-xs">
      <span className={cn("font-medium", OUTCOME_TONE[result.outcome])}>{t.outcome(result.outcome)}</span>
      {result.created && <span className="font-mono text-muted-foreground">{result.created.key}</span>}
      {result.detail && <span className="text-muted-foreground">{result.detail}</span>}
    </p>
  );
}

function DiffLine({ diff }: { diff: ActionDiff }) {
  return (
    <p className="flex flex-wrap items-center gap-1 text-xs">
      {diff.field && <span className="text-muted-foreground">{`${diff.field} :`}</span>}
      <span className="text-muted-foreground line-through">{diff.before}</span>
      <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
      <span>{diff.after}</span>
    </p>
  );
}

export function BatchActionRow(props: Props) {
  const { action, expected, labels, selectable, checked, result, onCheck } = props;
  const id = useId();
  const title = actionTitle(action, labels);
  const diffs = actionDiffs(action, expected, labels);
  const questionId = questionOf(action);
  return (
    <li className="flex gap-[10px] px-3.5 py-2.5">
      {selectable && (
        <Checkbox
          id={id}
          className="data-[state=checked]:border-(--tracking-brand-btn) data-[state=checked]:bg-(--tracking-brand-btn) data-[state=checked]:text-white dark:data-[state=checked]:bg-(--tracking-brand-btn) [&_svg]:size-[11px]"
          aria-label={title}
          checked={checked}
          onCheckedChange={(v) => onCheck(v === true)}
        />
      )}
      <div className="grid min-w-0 flex-1 gap-[3px]">
        {questionId === null ? (
          <label htmlFor={selectable ? id : undefined} className="text-[13px] leading-[16px] font-medium">
            {title}
          </label>
        ) : (
          <p className="text-[13px] leading-[16px] font-medium">
            <QuestionText questionId={questionId} text={title} />
          </p>
        )}
        {diffs.map((diff) => (
          <DiffLine key={diff.field ?? "diff"} diff={diff} />
        ))}
        {(diffs.length === 0 || action.type === "updateQuestion") && replacesContent(action) && (
          <p className="text-xs text-muted-foreground">{t.replaced}</p>
        )}
        {action.why && (
          <p className="text-xs leading-[15px] text-(--tracking-mfg)" title={t.why}>
            {action.why}
          </p>
        )}
        {result && <Outcome result={result} />}
      </div>
    </li>
  );
}
