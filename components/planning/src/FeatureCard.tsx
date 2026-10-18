import { useDraggable } from "@dnd-kit/core";
import { cn } from "@kibo/sdk/lib/utils";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@kibo/sdk/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { ContextMenuEntries, DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Ellipsis, GripVertical } from "lucide-react";
import { FeatureBadge } from "./FeatureBadge";
import { fr } from "./fr";
import { PenpotStroke } from "./PenpotStroke";
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

type BodyProps = { card: Card; preview?: boolean; onOpen?: () => void; menu?: readonly MenuEntry[] };

function CardMenu({ card, entries }: { card: Card; entries: readonly MenuEntry[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={fr.cardActions(card.shortKey)}
          className="grid size-[14px] shrink-0 place-items-center rounded-[3px] text-(--tracking-dim) opacity-0 hover:text-(--tracking-fg) focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <Ellipsis absoluteStrokeWidth size={13} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuEntries entries={entries} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const TITLE_CLASS = "line-clamp-2 text-left font-medium text-[13px] leading-[16px]";

export function FeatureCardBody({ card, preview = false, onOpen, menu }: BodyProps) {
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
        {card.slipped !== null && (
          <span className="truncate text-(--tracking-dim) text-[11px] leading-[14px]">
            {fr.slipped(card.slipped)}
          </span>
        )}
        {!preview && <FeatureBadge badge={card.badge} />}
        {menu && menu.length > 0 && <CardMenu card={card} entries={menu} />}
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

type Props = { card: Card; readOnly: boolean; onOpen: () => void; menu: readonly MenuEntry[] };

export function FeatureCard({ card, readOnly, onOpen, menu }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, disabled: readOnly });
  const article = (
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${card.shortKey} ${card.title}`}
      data-key={card.shortKey}
      className={cn(
        CARD_CLASS,
        "group relative",
        card.late ? "border-transparent" : "border-(--tracking-border)",
        !readOnly && "cursor-grab touch-none",
        isDragging && "opacity-40",
      )}
    >
      <FeatureCardBody card={card} onOpen={onOpen} menu={menu} />
      {card.late && <PenpotStroke color="var(--tracking-red)" radius={8} border={1} />}
    </article>
  );
  if (menu.length === 0) return article;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{article}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuEntries entries={menu} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function FeatureCardPreview({ card }: { card: Card }) {
  return (
    <div
      data-slot="planning-drag-preview"
      aria-hidden
      className={cn(
        CARD_CLASS,
        "relative border-transparent shadow-[0_10px_40px_rgb(0_0_0/0.17)] dark:shadow-[0_10px_40px_rgb(0_0_0/0.9)]",
      )}
    >
      <FeatureCardBody card={{ ...card, compact: false }} preview />
      <PenpotStroke color="var(--tracking-fg)" radius={8} border={1} />
    </div>
  );
}
