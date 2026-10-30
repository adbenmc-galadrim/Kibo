import type { Status } from "@kibo/schema";
import type { ReactNode } from "react";
import type { StepModel } from "./feature-model";
import { HeldSteps } from "./HeldSteps";
import { StepRow } from "./StepRow";

type HeldPart = { steps: readonly StepModel[]; projectId: string; editable: boolean };

type Props = {
  steps: readonly StepModel[];
  held?: HeldPart;
  workflow: readonly Status[];
  now: number;
  nextId: string | null;
  nextAction: ReactNode;
  onOpenTicket(id: string): void;
};

export function StepsTimeline({ steps, held, workflow, now, nextId, nextAction, onOpenTicket }: Props) {
  const holding = held !== undefined && held.steps.length > 0;
  return (
    <div className="flex w-full flex-col gap-[18px]">
      <ol className="flex w-full flex-col">
        {steps.map((step, i) => (
          <StepRow
            key={step.ticketId}
            step={step}
            workflow={workflow}
            now={now}
            last={i === steps.length - 1}
            spaced={holding}
            action={step.ticketId === nextId ? nextAction : null}
            onOpenTicket={onOpenTicket}
          />
        ))}
      </ol>
      {holding && <HeldSteps {...held} workflow={workflow} onOpenTicket={onOpenTicket} />}
    </div>
  );
}
