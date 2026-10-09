import type { ActionResult, ExpectedState, ProposedAction } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { ArrowRight } from "lucide-react";
import { useId } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { actionDiff, actionTitle, replacesContent, type StatusLabel } from "./batch-groups";

type Props = {
  action: ProposedAction;
  expected: ExpectedState | undefined;
  statusLabel: StatusLabel;
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

function Outcome({ result }: { result: ActionResult }) {
  return (
    <p className="flex flex-wrap items-center gap-1 text-xs">
      <span className={cn("font-medium", OUTCOME_TONE[result.outcome])}>{t.outcome(result.outcome)}</span>
      {result.created && <span className="font-mono text-muted-foreground">{result.created.key}</span>}
      {result.detail && <span className="text-muted-foreground">{result.detail}</span>}
    </p>
  );
}

export function BatchActionRow({
  action,
  expected,
  statusLabel,
  selectable,
  checked,
  result,
  onCheck,
}: Props) {
  const id = useId();
  const title = actionTitle(action, statusLabel);
  const diff = actionDiff(action, expected, statusLabel);
  return (
    <li className="flex gap-2 py-1.5">
      {selectable && (
        <Checkbox
          id={id}
          className="mt-0.5"
          aria-label={title}
          checked={checked}
          onCheckedChange={(v) => onCheck(v === true)}
        />
      )}
      <div className="grid min-w-0 flex-1 gap-0.5">
        <label htmlFor={selectable ? id : undefined} className="text-sm leading-snug">
          {title}
        </label>
        {diff && (
          <p className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-muted-foreground line-through">{diff.before}</span>
            <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
            <span>{diff.after}</span>
          </p>
        )}
        {!diff && replacesContent(action) && <p className="text-xs text-muted-foreground">{t.replaced}</p>}
        {action.why && (
          <p className="text-xs text-muted-foreground" title={t.why}>
            {action.why}
          </p>
        )}
        {result && <Outcome result={result} />}
      </div>
    </li>
  );
}
