import { cn } from "@kibo/sdk/lib/utils";
import type { CaseTone } from "@kibo/sdk/tracking";
import { Button } from "@kibo/sdk/ui/button";
import { Copy, Flag, Truck } from "lucide-react";
import { useState } from "react";
import { fr } from "./fr";
import { CARD, CardHeader, MONO_KEY, Segments } from "./parts";
import type { NextCard, RemainingStep } from "./sprint-model";

export type NextActions = {
  execution: "shown" | "hidden";
  copy(command: string): Promise<void>;
  deliver(ticketId: string): Promise<void>;
  onOpenTicket(id: string): void;
};
type Feedback = "idle" | "copied" | "refused" | "failed";

const DOT: Record<CaseTone, string> = {
  done: "bg-(--tracking-fg)",
  review: "bg-(--tracking-purple)",
  progress: "bg-(--tracking-blue)",
  blocked: "bg-(--tracking-red)",
  todo: "border-[1.5px] border-(--tracking-dim)",
};
const SEGMENTS_WIDTH = 122;

function StepLine({ step, onOpen }: { step: RemainingStep; onOpen(id: string): void }) {
  return (
    <li className="flex h-[16px] items-center gap-[8px]">
      <span
        aria-hidden
        data-tone={step.tone}
        className={cn("size-[8px] shrink-0 rounded-full", DOT[step.tone])}
      />
      <span className={MONO_KEY}>{step.key}</span>
      <button
        type="button"
        className="cursor-pointer truncate text-left text-(--tracking-fg) text-[13px] leading-[16px] hover:underline"
        onClick={() => onOpen(step.ticketId)}
      >
        {step.title}
      </button>
      {step.changes && (
        <span className="shrink-0 text-(--tracking-amber) text-[12px]">{fr.next.changes}</span>
      )}
    </li>
  );
}

function NextStep({ deliver, actions }: { deliver: NonNullable<NextCard["deliver"]>; actions: NextActions }) {
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const shown = actions.execution === "shown";
  const run = () =>
    shown
      ? actions.deliver(deliver.ticketId).then(
          () => setFeedback("idle"),
          () => setFeedback("failed"),
        )
      : actions.copy(deliver.command).then(
          () => setFeedback("copied"),
          () => setFeedback("refused"),
        );
  const error =
    feedback === "refused" ? fr.next.copyRefused : feedback === "failed" ? fr.next.deliverFailed : null;
  return (
    <div className="flex min-h-[41px] flex-wrap items-center gap-[10px] rounded-[8px] bg-(--tracking-muted) py-[8px] pr-[10px] pl-[12px]">
      <span className="font-medium text-(--tracking-mfg) text-[12px] leading-[15px]">{fr.next.step}</span>
      <code className="font-mono text-(--tracking-fg) text-[12.5px] leading-[15px]">{deliver.command}</code>
      <Button
        variant="outline"
        className="ml-auto h-[25px] gap-[6px] rounded-[6px] px-[10px] py-[5px] font-medium text-[12px] shadow-none has-[>svg]:px-[10px]"
        onClick={() => void run()}
      >
        {shown ? <Truck absoluteStrokeWidth size={13} /> : <Copy absoluteStrokeWidth size={13} />}
        {shown ? fr.next.deliver : fr.next.copy}
      </Button>
      <output className="sr-only">{feedback === "copied" ? fr.next.copied : ""}</output>
      {error && (
        <p role="alert" className="basis-full text-(--tracking-red) text-[12px]">
          {error}
        </p>
      )}
    </div>
  );
}

export function NextFeatureCard({ card, actions }: { card: NextCard | null; actions: NextActions }) {
  const width =
    card === null ? 0 : (SEGMENTS_WIDTH - 3 * (card.tones.length - 1)) / Math.max(1, card.tones.length);
  return (
    <section aria-label={fr.next.title} className={CARD}>
      <CardHeader
        icon={Flag}
        title={fr.next.title}
        aside={<span className="text-(--tracking-mfg) text-[12.5px] leading-[15px]">{fr.next.subtitle}</span>}
      />
      {card === null ? (
        <p className="px-[16px] pb-[14px] text-(--tracking-mfg) text-[12.5px]">{fr.next.none}</p>
      ) : (
        <div className="flex flex-col gap-[10px] px-[16px] pt-[2px] pb-[14px]">
          <div className="flex h-[18px] items-center gap-[10px]">
            <span className={MONO_KEY}>{card.shortKey}</span>
            <button
              type="button"
              className="min-w-0 flex-1 cursor-pointer truncate text-left font-semibold text-(--tracking-fg) text-[15px] leading-[18px] hover:underline"
              onClick={() => actions.onOpenTicket(card.id)}
            >
              {card.title}
            </button>
            <Segments tones={card.tones} width={width} />
            <span className="font-mono text-(--tracking-fg) text-[12.5px] leading-[15px]">{card.steps}</span>
          </div>
          <ul className="flex flex-col gap-[6px]">
            {card.remaining.map((step) => (
              <StepLine key={step.ticketId} step={step} onOpen={actions.onOpenTicket} />
            ))}
          </ul>
          {card.deliver !== null && <NextStep deliver={card.deliver} actions={actions} />}
        </div>
      )}
    </section>
  );
}
