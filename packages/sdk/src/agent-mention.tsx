import { type RunPeek, type RunState, runSubject } from "@kibo/schema";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { fr } from "./fr";
import { cn } from "./lib/utils";
import { RUN_TEXT, RunDot } from "./status";
import { Button } from "./ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";

export type MentionTexts = {
  history: string;
  reply: string;
  step(index: number, total: number, title: string): string;
  state(state: RunState): string;
  waiting: string;
};

export type AgentMentionProps = {
  runId: string;
  label: string;
  state?: RunState;
  className?: string;
  texts: MentionTexts;
  peek(runId: string): Promise<RunPeek>;
  onOpen(runId: string): void;
  onReply?(runId: string): void;
  openDelay?: number;
};

const MESSAGE_MAX = 200;
const clip = (text: string): string => (text.length > MESSAGE_MAX ? `${text.slice(0, MESSAGE_MAX)}…` : text);

type Peeked = { status: "idle" } | { status: "ready"; peek: RunPeek } | { status: "missing" };

function usePeek(open: boolean, runId: string, peek: AgentMentionProps["peek"]): Peeked {
  const [peeked, setPeeked] = useState<Peeked>({ status: "idle" });
  const asked = useRef(false);
  useEffect(() => {
    if (!open || asked.current) return;
    asked.current = true;
    peek(runId).then(
      (value) => setPeeked({ status: "ready", peek: value }),
      () => setPeeked({ status: "missing" }),
    );
  }, [open, runId, peek]);
  return peeked;
}

function CardLine({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("truncate text-xs", className)}>{children}</p>;
}

type CardProps = Pick<AgentMentionProps, "texts" | "onOpen" | "onReply"> & { peek: RunPeek };

function PeekCard({ peek, texts, onOpen, onReply }: CardProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-sm">
        <RunDot state={peek.state} />
        <span className="font-medium">{peek.profileName}</span>
        <span className={cn("text-xs", RUN_TEXT[peek.state])}>{texts.state(peek.state)}</span>
      </div>
      <CardLine className="text-muted-foreground">{runSubject(peek)}</CardLine>
      {peek.step && <CardLine>{texts.step(peek.step.index, peek.step.total, peek.step.title)}</CardLine>}
      {peek.waiting && <CardLine className={RUN_TEXT.waiting_input}>{texts.waiting}</CardLine>}
      {peek.lastMessage && (
        <p className="line-clamp-3 text-xs text-muted-foreground">{clip(peek.lastMessage)}</p>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={() => onOpen(peek.runId)}>
          {texts.history}
        </Button>
        {peek.waiting && onReply && (
          <Button size="sm" onClick={() => onReply(peek.runId)}>
            {texts.reply}
          </Button>
        )}
      </div>
    </div>
  );
}

type DelayedOpen = { open: boolean; schedule(): void; show(): void; cancel(): void; close(): void };

function useDelayedOpen(delay: number): DelayedOpen {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const show = () => {
    cancel();
    setOpen(true);
  };
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  return {
    open,
    show,
    cancel,
    schedule: () => {
      cancel();
      timer.current = setTimeout(show, delay);
    },
    close: () => {
      cancel();
      setOpen(false);
    },
  };
}

export function AgentMention(props: AgentMentionProps) {
  const { runId, label, state, className, texts, onOpen, onReply, openDelay = 300 } = props;
  const card = useDelayedOpen(openDelay);
  const peeked = usePeek(card.open, runId, props.peek);
  return (
    <HoverCard open={card.open} onOpenChange={(next) => !next && card.close()}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn("inline-flex min-w-0 items-center gap-1 rounded-sm hover:underline", className)}
          onPointerEnter={card.schedule}
          onPointerLeave={card.cancel}
          onFocus={card.show}
          onClick={() => {
            card.close();
            onOpen(runId);
          }}
        >
          {state && <RunDot state={state} className="size-1.5" />}
          <span className="truncate font-mono">{label}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 p-3">
        {peeked.status === "ready" && (
          <PeekCard peek={peeked.peek} texts={texts} onOpen={onOpen} onReply={onReply} />
        )}
        {peeked.status === "missing" && <p className="text-xs text-muted-foreground">{fr.runMissing}</p>}
      </HoverCardContent>
    </HoverCard>
  );
}
