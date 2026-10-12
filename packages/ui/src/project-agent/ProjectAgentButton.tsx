import type { AgentsState } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Sparkles } from "lucide-react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { frSignals } from "../i18n/fr-signals";
import { isMac, shortcutLabel } from "../lib/shortcut-label";

type Props = {
  projectId: string;
  agents: AgentsState | null;
  open: boolean;
  onToggle(): void;
  onOpenSignals(): void;
};

export const hasPendingBatch = (agents: AgentsState | null, projectId: string): boolean =>
  agents?.projectAgents.some((p) => p.projectId === projectId && p.pendingBatchId !== null) ?? false;

export const signalCount = (agents: AgentsState | null, projectId: string): number =>
  agents?.signals.find((s) => s.projectId === projectId)?.open ?? 0;

function buttonLabel(signals: number, pending: boolean): string {
  if (signals > 0) return `${frProjectAgent.button} · ${frSignals.button.signals(signals)}`;
  return pending ? `${frProjectAgent.button} · ${frProjectAgent.pending}` : frProjectAgent.button;
}

export function ProjectAgentButton({ projectId, agents, open, onToggle, onOpenSignals }: Props) {
  const pending = hasPendingBatch(agents, projectId);
  const signals = signalCount(agents, projectId);
  return (
    <span className="relative inline-flex">
      <Button
        variant={open ? "secondary" : "ghost"}
        size="sm"
        className="h-7"
        aria-label={buttonLabel(signals, pending)}
        aria-pressed={open}
        title={frProjectAgent.buttonTitle(shortcutLabel(["J"], isMac()))}
        onClick={onToggle}
      >
        <Sparkles className="text-brand-strong dark:text-brand" />
        {frProjectAgent.button}
      </Button>
      {signals > 0 ? (
        <button
          type="button"
          className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white tabular-nums ring-2 ring-background"
          aria-label={frSignals.button.open}
          title={frSignals.button.signals(signals)}
          onClick={onOpenSignals}
        >
          {signals}
        </button>
      ) : (
        pending && (
          <span
            className="pointer-events-none absolute -top-0.5 -right-0.5 size-2 rounded-full bg-brand ring-2 ring-background"
            aria-hidden
          />
        )
      )}
    </span>
  );
}
