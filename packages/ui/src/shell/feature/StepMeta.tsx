import { GitBranch, GitMerge, GitPullRequest, Link } from "lucide-react";
import { frFeature as t } from "../../i18n/fr-group";
import { DeliverySegments } from "./DeliverySegments";
import type { StepModel } from "./feature-model";
import { stepTime } from "./time-format";

const MONO = "font-mono text-[12px] leading-[15px] text-(--tracking-fg)";
const DIM = "text-[12px] leading-[15px] text-(--tracking-dim)";

function Origin({ step }: { step: StepModel }) {
  if (step.pr) {
    const merged = step.pr.state === "merged";
    const Icon = merged ? GitMerge : GitPullRequest;
    return (
      <span className="flex items-center gap-[5px]">
        <Icon
          absoluteStrokeWidth
          size={13}
          aria-hidden
          className={`size-[13px] ${merged ? "text-(--tracking-green)" : "text-(--tracking-purple)"}`}
        />
        <span className={MONO}>{`#${step.pr.number}`}</span>
        {merged && <span className={DIM}>{t.merged}</span>}
      </span>
    );
  }
  if (step.branch)
    return (
      <span className="flex min-w-0 items-center gap-[5px]">
        <GitBranch
          absoluteStrokeWidth
          size={13}
          aria-hidden
          className="size-[13px] shrink-0 text-(--tracking-blue)"
        />
        <span className={`truncate ${MONO}`}>{step.branch}</span>
      </span>
    );
  const [blocker] = step.blockedBy;
  if (!blocker) return null;
  return (
    <span className="flex items-center gap-[5px]">
      <Link absoluteStrokeWidth size={12} aria-hidden className="size-[12px] text-(--tracking-dim)" />
      <span className={DIM}>{t.waiting(step.blockedBy.join(", "))}</span>
    </span>
  );
}

export function StepMeta({ step, now }: { step: StepModel; now: number }) {
  return (
    <div className="flex h-[15px] w-full items-center gap-[12px]">
      <Origin step={step} />
      {step.delivery && (
        <span className="text-[11.5px] leading-[14px] text-(--tracking-dim)">
          {stepTime(step.delivery.at, now)}
        </span>
      )}
      <DeliverySegments delivery={step.delivery} />
    </div>
  );
}
