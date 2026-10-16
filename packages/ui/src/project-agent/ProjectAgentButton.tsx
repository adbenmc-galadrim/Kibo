import type { AgentsState } from "@kibo/schema";
import { Bot } from "lucide-react";
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
    <span data-open={open || undefined} className="k-agent">
      <button
        type="button"
        aria-label={buttonLabel(signals, pending)}
        aria-pressed={open}
        title={frProjectAgent.buttonTitle(shortcutLabel(["J"], isMac()))}
        className="k-focus"
        onClick={onToggle}
      >
        <Bot aria-hidden size={15} absoluteStrokeWidth />
        {frProjectAgent.button}
      </button>
      {signals > 0 ? (
        <button
          type="button"
          className="k-focus"
          aria-label={frSignals.button.open}
          title={frSignals.button.signals(signals)}
          onClick={onOpenSignals}
        >
          {signals}
        </button>
      ) : (
        pending && <span aria-hidden className="size-2 rounded-full bg-(--tracking-brand)" />
      )}
    </span>
  );
}
