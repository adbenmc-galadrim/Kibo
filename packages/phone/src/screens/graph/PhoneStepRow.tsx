import {
  activeThread,
  fr,
  GIT_ICON,
  GIT_TEXT,
  HoldMark,
  type LaneStep,
  StepDot,
  StepThreadPill,
  stepRowBorder,
} from "@kibo/component-graph/models";
import { useLongPress } from "./use-long-press";

type Props = { step: LaneStep; onOpen(id: string): void; onMenu(step: LaneStep): void };

const PRESS = "select-none [-webkit-touch-callout:none]";

export function PhoneStepRow({ step, onOpen, onMenu }: Props) {
  const press = useLongPress(
    () => onMenu(step),
    () => onOpen(step.ticketId),
  );
  const thread = activeThread(step);
  const Icon = step.git === null || thread !== null ? null : GIT_ICON[step.git.kind];
  return (
    <li
      data-session={step.session ? "true" : undefined}
      data-startable={step.startable ? "true" : undefined}
      className={`min-h-11 rounded-lg border bg-(--tracking-card) ${stepRowBorder(step)}`}
    >
      <button
        type="button"
        title={step.key}
        {...press}
        className={`flex min-h-11 w-full items-center gap-2.5 rounded-[7px] px-3 text-left active:bg-(--tracking-hover) ${PRESS}`}
      >
        <StepDot tone={step.tone} className="size-2" />
        <span
          className={`min-w-0 flex-1 truncate text-[13px] font-medium leading-4 ${step.tone === "done" ? "text-(--tracking-dim)" : "text-(--tracking-fg)"}`}
        >
          {step.title}
        </span>
        {step.session && thread === null && (
          <span
            role="img"
            aria-label={fr.sprints.session}
            className="size-1.5 shrink-0 rounded-full bg-(--tracking-brand)"
          />
        )}
        {step.hold !== null && thread === null && <HoldMark hold={step.hold} />}
        {thread !== null && <StepThreadPill thread={thread} />}
        {Icon !== null && step.git !== null && (
          <Icon
            size={15}
            absoluteStrokeWidth
            aria-label={fr.sprints.git[step.git.kind]}
            className={`shrink-0 ${GIT_TEXT[step.git.tone]}`}
          />
        )}
      </button>
    </li>
  );
}
