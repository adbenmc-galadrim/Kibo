import type { AgentsState } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Bot, ChevronDown, ChevronUp, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "../i18n/fr";
import { BarRuns } from "../shell/lazy-screens";
import { barSummary } from "./bar-summary";
import { SlotMeter } from "./SlotMeter";

type Props = {
  state: AgentsState;
  now: number;
  online: boolean;
  indicator?: ReactNode;
  expanded: boolean;
  onToggle(): void;
  onSelect(runId: string): void;
  onSubagent?(runId: string, subagentId: string): void;
  onLaunch?(): void;
};

export function AgentBar(props: Props) {
  const { state, now, online, indicator, expanded, onToggle, onSelect, onSubagent, onLaunch } = props;
  const Chevron = expanded ? ChevronDown : ChevronUp;
  return (
    <div className="group/bar relative flex min-h-10 text-[11px]">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? fr.agents.collapse : fr.agents.expand}
        onClick={onToggle}
        className="absolute inset-0 cursor-pointer outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      />
      <div className="pointer-events-none relative flex min-h-10 flex-1 items-center gap-3 overflow-hidden px-3 py-1 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        <span className="flex shrink-0 items-center gap-2 text-xs font-medium">
          <Bot aria-hidden className="size-4" />
          {fr.agents.bar}
        </span>
        <SlotMeter used={state.host.used} total={state.host.hostSlots} className="shrink-0" />
        <span className="shrink-0 text-muted-foreground">{barSummary(state, fr.agents)}</span>
        {!expanded && (
          <BarRuns state={state} now={now} onSelect={onSelect} onSubagent={onSubagent} onMore={onToggle} />
        )}
        <span className="flex-1" />
        {!expanded &&
          (indicator ?? (
            <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", online ? "bg-green-500" : "bg-red-500")}
              />
              {online ? fr.agents.daemon : fr.agents.daemonOffline}
            </span>
          ))}
        {expanded && onLaunch && (
          <Button size="sm" variant="outline" className="h-7" onClick={onLaunch}>
            <Plus />
            {fr.agents.launch}
          </Button>
        )}
        <Chevron aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </div>
    </div>
  );
}
