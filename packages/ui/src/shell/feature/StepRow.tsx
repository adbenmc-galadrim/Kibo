import type { Status } from "@kibo/schema";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { frFeature as t } from "../../i18n/fr-group";
import type { StepModel } from "./feature-model";
import { StepMeta } from "./StepMeta";
import { CARD, STATUS_FILL, STEP_CIRCLE, STROKE, STROKE_BRAND, STROKE_MFG } from "./styles";

type Props = {
  step: StepModel;
  workflow: readonly Status[];
  now: number;
  last: boolean;
  action: ReactNode | null;
  onOpenTicket(id: string): void;
};

function Marker({ step }: { step: StepModel }) {
  const done = step.statusId === "done";
  const fill = done
    ? "bg-(--tracking-fg) text-(--tracking-bg)"
    : (STEP_CIRCLE[step.statusId] ?? `bg-(--tracking-bg) text-(--tracking-mfg) ${STROKE}`);
  return (
    <span
      data-testid="step-marker"
      className={`flex size-[28px] shrink-0 items-center justify-center rounded-full font-mono text-[12px] leading-[15px] font-semibold ${fill}`}
    >
      {done ? <Check absoluteStrokeWidth size={14} aria-hidden className="size-[14px]" /> : step.index}
    </span>
  );
}

function StatusLabel({ step, workflow }: { step: StepModel; workflow: readonly Status[] }) {
  const fill = STATUS_FILL[step.statusId];
  return (
    <span className="ml-auto flex shrink-0 items-center gap-[6px]">
      <span
        aria-hidden
        className={`size-[8px] rounded-full ${fill ?? "shadow-[0_0_0_0.75px_var(--tracking-dim),inset_0_0_0_0.75px_var(--tracking-dim)]"}`}
      />
      <span className="text-[12.5px] leading-[15px] text-(--tracking-fg)">
        {workflow.find((s) => s.id === step.statusId)?.label ?? step.statusId}
      </span>
    </span>
  );
}

const cardTone = (step: StepModel, next: boolean): string => {
  if (next) return `rounded-[8px] bg-(--tracking-muted) ${STROKE_MFG}`;
  if (step.session) return `rounded-[8px] bg-(--tracking-card) ${STROKE_BRAND}`;
  return CARD;
};

export function StepRow({ step, workflow, now, last, action, onOpenTicket }: Props) {
  const done = step.statusId === "done";
  return (
    <li
      data-status={step.statusId}
      data-session={step.session !== null}
      className={`flex w-full gap-[14px] ${last ? "h-[28px]" : "h-[100px]"}`}
    >
      <span className="flex w-[28px] shrink-0 flex-col items-center">
        <Marker step={step} />
        {!last && (
          <span
            aria-hidden
            className={`w-[2px] flex-1 ${done ? "bg-(--tracking-fg)" : "bg-(--tracking-border)"}`}
          />
        )}
      </span>
      <div className="min-w-0 flex-1 pb-[16px]">
        <div className={`flex flex-col gap-[7px] px-[14px] py-[10px] ${cardTone(step, action !== null)}`}>
          <div className="flex w-full items-center gap-[8px]">
            <button
              type="button"
              className={`min-w-0 truncate text-left text-[14px] leading-[17px] font-medium hover:underline ${done ? "text-(--tracking-mfg)" : "text-(--tracking-fg)"}`}
              onClick={() => onOpenTicket(step.ticketId)}
            >
              {step.title}
            </button>
            <span className="shrink-0 font-mono text-[11.5px] leading-[14px] text-(--tracking-dim)">
              {step.key}
            </span>
            {step.session && (
              <span
                className={`flex shrink-0 items-center gap-[6px] rounded-[12px] bg-(--tracking-brand-soft) px-[8px] py-[3px] ${STROKE_BRAND}`}
              >
                <span aria-hidden className="size-[6px] rounded-full bg-(--tracking-brand)" />
                <span className="text-[11.5px] leading-[14px] font-medium text-(--tracking-brand-text)">
                  {t.session(step.session.agent, step.session.minutes)}
                </span>
              </span>
            )}
            <StatusLabel step={step} workflow={workflow} />
          </div>
          <StepMeta step={step} now={now} />
          {action}
        </div>
      </div>
    </li>
  );
}
