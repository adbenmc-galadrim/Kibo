import { useDraggable } from "@dnd-kit/core";
import { cn } from "@kibo/sdk/lib/utils";
import { GripVertical } from "lucide-react";
import { FeatureBadge } from "./FeatureBadge";
import { fr } from "./fr";
import type { FeatureCard as Card } from "./planning-model";
import { StepCases } from "./StepCases";

export const CARD_CLASS =
  "flex w-full flex-col gap-2 rounded-[8px] border bg-(--tracking-card) px-[11px] py-[9px] text-left";

function CardFooter({ card }: { card: Card }) {
  return (
    <div className="flex h-[14px] items-center gap-1.5">
      <span className="text-(--tracking-dim) text-[11.5px] leading-[14px]">
        {fr.steps(card.done, card.total)}
      </span>
      {card.session !== null ? (
        <span className="ml-auto flex items-center gap-1.5" title={fr.session(card.session)}>
          <span aria-hidden className="size-1.5 rounded-full bg-(--tracking-brand)" />
          <span className="font-mono text-(--tracking-brand-text) text-[11px] leading-[14px]">
            {card.session}
          </span>
        </span>
      ) : (
        card.next !== null && (
          <span className="ml-auto text-(--tracking-dim) text-[11px] leading-[14px]">
            {fr.next(card.next)}
          </span>
        )
      )}
    </div>
  );
}

type BodyProps = { card: Card; preview?: boolean; onOpen?: () => void };

const TITLE_CLASS = "line-clamp-2 text-left font-medium text-[13px] leading-[16px]";

export function FeatureCardBody({ card, preview = false, onOpen }: BodyProps) {
  const tone = card.muted ? "text-(--tracking-mfg)" : "text-(--tracking-fg)";
  return (
    <>
      <div className="flex min-h-[14px] items-center gap-1.5">
        <GripVertical
          absoluteStrokeWidth
          size={13}
          aria-hidden
          className={cn(preview ? "text-(--tracking-mfg)" : "text-(--tracking-faint)")}
        />
        <span className="font-mono text-(--tracking-dim) text-[11px] leading-[14px]">{card.shortKey}</span>
        {!preview && <FeatureBadge badge={card.badge} />}
      </div>
      {onOpen ? (
        <button
          type="button"
          title={card.title}
          className={cn(TITLE_CLASS, tone, "cursor-pointer")}
          onClick={onOpen}
        >
          {card.title}
        </button>
      ) : (
        <span className={cn(TITLE_CLASS, tone)}>{card.title}</span>
      )}
      {!card.compact && <StepCases steps={card.steps} />}
      {!card.compact && !preview && <CardFooter card={card} />}
    </>
  );
}

type Props = { card: Card; readOnly: boolean; onOpen: () => void };

export function FeatureCard({ card, readOnly, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, disabled: readOnly });
  return (
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${card.shortKey} ${card.title}`}
      data-key={card.shortKey}
      className={cn(
        CARD_CLASS,
        card.late ? "border-(--tracking-red)" : "border-(--tracking-border)",
        !readOnly && "cursor-grab touch-none",
        isDragging && "opacity-40",
      )}
    >
      <FeatureCardBody card={card} onOpen={onOpen} />
    </article>
  );
}

export function FeatureCardPreview({ card }: { card: Card }) {
  return (
    <div data-slot="planning-drag-preview" aria-hidden className={cn(CARD_CLASS, "border-(--tracking-fg)")}>
      <FeatureCardBody card={{ ...card, compact: false }} preview />
    </div>
  );
}
