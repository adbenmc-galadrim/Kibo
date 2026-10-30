import type { Question, QuestionRecipient, TicketView } from "@kibo/schema";
import { type ComponentType, lazy, type PointerEvent, type ReactElement, Suspense, useState } from "react";
import { useDelayedOpen } from "./agent-mention";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";

export const QUESTION_PREVIEW_DELAY = 300;

export type QuestionPreviewProps = {
  mode: "ticket" | "question";
  questions: readonly Question[];
  recipients: readonly QuestionRecipient[];
  ticket: Pick<TicketView, "id" | "keyLabel" | "title">;
  runLabel(runId: string): string;
  onOpen(questionId: string): void;
  children: ReactElement;
};

type ContentProps = Omit<QuestionPreviewProps, "children"> & { now: number };

let loaded: ComponentType<ContentProps> | null = null;

const contentOf = (): ComponentType<ContentProps> => {
  loaded ??= lazy(() =>
    import("./question-preview-content").then((m) => ({ default: m.QuestionPreviewContent })),
  );
  return loaded;
};

const canHover = (): boolean =>
  typeof window.matchMedia !== "function" || !window.matchMedia("(hover: none)").matches;

export function QuestionPreview({ children, ...props }: QuestionPreviewProps) {
  const card = useDelayedOpen(QUESTION_PREVIEW_DELAY);
  const Content = contentOf();
  const [hover] = useState(canHover);
  if (!hover) return children;
  const enter = (e: PointerEvent) => {
    if (e.pointerType !== "touch") card.schedule();
  };
  return (
    <HoverCard open={card.open} onOpenChange={(next) => !next && card.close()}>
      <HoverCardTrigger asChild onPointerEnter={enter} onPointerLeave={card.cancel} onFocus={card.show}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        className="w-80 max-w-[calc(100vw-2rem)] p-2"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {card.open && (
          <Suspense fallback={null}>
            <Content {...props} now={Date.now()} />
          </Suspense>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
