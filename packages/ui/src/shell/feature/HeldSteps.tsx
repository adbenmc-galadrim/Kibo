import type { OnHold, Status } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Link, Pause } from "lucide-react";
import { useId } from "react";
import { frFeature } from "../../i18n/fr-group";
import { frHold, holdDay } from "../../i18n/fr-hold";
import { useHold } from "../../ticket/use-hold";
import type { StepModel } from "./feature-model";
import { STATUS_FILL, STROKE } from "./styles";

type Props = {
  projectId: string;
  steps: readonly StepModel[];
  workflow: readonly Status[];
  editable: boolean;
  onOpenTicket(id: string): void;
};

const t = frHold.feature;
const MFG = "text-[12.5px] leading-[15px] text-(--tracking-mfg)";
const RESUME =
  "ml-auto h-[25px] shrink-0 gap-[6px] rounded-[6px] px-[10px] py-[5px] text-[12px] leading-[15px] font-medium shadow-none";

function StepStatus({ step, workflow }: { step: StepModel; workflow: readonly Status[] }) {
  const fill = STATUS_FILL[step.statusId];
  return (
    <span className="ml-auto flex shrink-0 items-center gap-[6px]">
      <span
        aria-hidden
        className={`size-[8px] rounded-full ${fill ?? "shadow-[0_0_0_0.75px_var(--tracking-dim),inset_0_0_0_0.75px_var(--tracking-dim)]"}`}
      />
      <span className={MFG}>{workflow.find((s) => s.id === step.statusId)?.label ?? step.statusId}</span>
    </span>
  );
}

function OwnHold({
  hold,
  ticketId,
  projectId,
  editable,
}: {
  hold: OnHold;
  ticketId: string;
  projectId: string;
  editable: boolean;
}) {
  const command = useHold(projectId, ticketId);
  return (
    <>
      <div className="flex min-h-[25px] w-full items-center gap-[6px]">
        <Pause
          absoluteStrokeWidth
          size={12}
          aria-hidden
          className="size-[12px] shrink-0 text-(--tracking-hold)"
        />
        <span className={`min-w-0 truncate ${MFG}`}>{t.since(hold.reason, holdDay(hold.since))}</span>
        {editable && (
          <Button
            variant="outline"
            className={RESUME}
            disabled={command.busy}
            onClick={() => void command.resume()}
          >
            {frHold.resume}
          </Button>
        )}
      </div>
      {command.error && (
        <p role="alert" className="text-[12px] leading-[15px] text-(--tracking-red)">
          {command.error}
        </p>
      )}
    </>
  );
}

function DependencyHold({ hold }: { hold: OnHold }) {
  return (
    <div className="flex h-[15px] w-full items-center gap-[6px]">
      <Link
        absoluteStrokeWidth
        size={12}
        aria-hidden
        className="size-[12px] shrink-0 text-(--tracking-mfg)"
      />
      <span className={MFG}>{frFeature.waiting(hold.key)}</span>
    </div>
  );
}

function HeldRow({ step, ...p }: Omit<Props, "steps"> & { step: StepModel }) {
  const hold = step.onHold;
  if (hold === null) return null;
  return (
    <li data-ticket={step.key} className="flex w-full gap-[14px]">
      <span className="flex size-[28px] shrink-0 items-center justify-center rounded-full bg-(--tracking-hold-soft)">
        <Pause absoluteStrokeWidth size={13} aria-hidden className="size-[13px] text-(--tracking-hold)" />
      </span>
      <div className={`flex min-w-0 flex-1 flex-col gap-[7px] rounded-[8px] px-[14px] py-[10px] ${STROKE}`}>
        <div className="flex w-full items-center gap-[8px]">
          <button
            type="button"
            className="min-w-0 truncate text-left text-[14px] leading-[17px] font-medium text-(--tracking-mfg) hover:underline"
            onClick={() => p.onOpenTicket(step.ticketId)}
          >
            {step.title}
          </button>
          <span className="shrink-0 font-mono text-[12px] leading-[15px] text-(--tracking-dim)">
            {step.key}
          </span>
          <StepStatus step={step} workflow={p.workflow} />
        </div>
        {hold.source === "own" ? (
          <OwnHold hold={hold} ticketId={step.ticketId} projectId={p.projectId} editable={p.editable} />
        ) : (
          <DependencyHold hold={hold} />
        )}
      </div>
    </li>
  );
}

export function HeldSteps({ steps, ...p }: Props) {
  const title = useId();
  return (
    <section aria-labelledby={title} className="flex w-full flex-col gap-[12px] pt-[6px]">
      <div className="flex h-[25px] w-full items-center gap-[10px]">
        <Pause
          absoluteStrokeWidth
          size={15}
          aria-hidden
          className="size-[15px] shrink-0 text-(--tracking-hold)"
        />
        <h2 id={title} className="text-[15px] leading-[18px] font-semibold text-(--tracking-fg)">
          {frFeature.heldSection(steps.length)}
        </h2>
        <span className="text-[12.5px] leading-[15px] text-(--tracking-dim)">{t.hint}</span>
      </div>
      <ol className="flex w-full flex-col gap-[12px]">
        {steps.map((step) => (
          <HeldRow key={step.ticketId} step={step} {...p} />
        ))}
      </ol>
    </section>
  );
}
