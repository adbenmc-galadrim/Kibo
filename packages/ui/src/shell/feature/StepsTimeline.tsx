import type { Status } from "@kibo/schema";
import type { ReactNode } from "react";
import type { StepModel } from "./feature-model";
import { StepRow } from "./StepRow";

type Props = {
  steps: readonly StepModel[];
  workflow: readonly Status[];
  now: number;
  nextId: string | null;
  nextAction: ReactNode;
  onOpenTicket(id: string): void;
};

export function StepsTimeline({ steps, workflow, now, nextId, nextAction, onOpenTicket }: Props) {
  return (
    <ol className="flex w-full flex-col">
      {steps.map((step, i) => (
        <StepRow
          key={step.ticketId}
          step={step}
          workflow={workflow}
          now={now}
          last={i === steps.length - 1}
          action={step.ticketId === nextId ? nextAction : null}
          onOpenTicket={onOpenTicket}
        />
      ))}
    </ol>
  );
}
