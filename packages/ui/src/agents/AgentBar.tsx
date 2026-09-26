import { type AgentsState, runSubject } from "@kibo/schema";
import { RunDot } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Bot, ChevronUp } from "lucide-react";
import { useRef } from "react";
import { fr } from "../i18n/fr";
import { elapsed, formatDuration } from "./format";
import { SlotMeter } from "./SlotMeter";
import { useWrappedCount } from "./use-wrapped-count";

type Props = {
  state: AgentsState;
  now: number;
  online: boolean;
  onExpand: () => void;
  onSelect: (runId: string) => void;
};

export function AgentBar({ state, now, online, onExpand, onSelect }: Props) {
  const running = state.runs
    .filter((r) => r.state === "running" || r.state === "starting")
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
  const waiting = state.runs.filter((r) => r.state === "waiting_input");
  const listRef = useRef<HTMLUListElement>(null);
  const hidden = useWrappedCount(listRef);
  return (
    <div className="flex h-10 items-center gap-3 overflow-hidden px-3 text-[11px]">
      <span className="flex shrink-0 items-center gap-2 text-xs font-medium">
        <Bot aria-hidden className="size-4" />
        {fr.agents.bar}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <SlotMeter used={state.host.used} total={state.host.hostSlots} />
        <span className="font-mono">{fr.agents.slots(state.host.used, state.host.hostSlots)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <RunDot state="queued" />
        {fr.agents.queued(state.queue.length)}
      </span>
      <ul ref={listRef} className="flex h-4 min-w-0 flex-wrap items-center gap-x-3 overflow-hidden">
        {running.map((r) => (
          <li key={r.id} className="flex h-4 shrink-0 items-center">
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              className="flex items-center gap-1.5 whitespace-nowrap"
            >
              <RunDot state={r.state} />
              <span className="font-mono">{r.label}</span>
              <span className="text-muted-foreground">{runSubject(r, formatDuration(elapsed(r, now)))}</span>
            </button>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 shrink-0 px-1.5 font-mono text-xs"
          aria-label={fr.agents.moreRuns(hidden)}
          onClick={onExpand}
        >
          {`+${hidden}`}
        </Button>
      )}
      {waiting.map((r) => (
        <span key={r.id} className="flex shrink-0 items-center gap-1.5 border-l pl-3">
          <RunDot state="waiting_input" />
          <span className="font-mono">{r.label}</span>
          <span className="text-muted-foreground">{runSubject(r, fr.agents.waitingShort)}</span>
          <Button
            size="sm"
            className="h-6 px-2.5 text-xs bg-brand-strong text-white hover:bg-brand-strong/90"
            aria-label={fr.agents.answerTo(r.label)}
            onClick={() => onSelect(r.id)}
          >
            {fr.agents.answer}
          </Button>
        </span>
      ))}
      <span className="flex-1" />
      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <span aria-hidden className={cn("size-1.5 rounded-full", online ? "bg-green-500" : "bg-red-500")} />
        {online ? fr.agents.daemon : fr.agents.daemonOffline}
      </span>
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label={fr.agents.expand}
        aria-expanded={false}
        onClick={onExpand}
      >
        <ChevronUp />
      </Button>
    </div>
  );
}
