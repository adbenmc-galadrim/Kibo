import type { AgentsState } from "@kibo/schema";
import { Bot } from "lucide-react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { frSignals } from "../i18n/fr-signals";
import { isMac, shortcutLabel } from "../lib/shortcut-label";
import { usePendingCount } from "./use-pending-count";

type Props = {
  projectId: string;
  agents: AgentsState | null;
  open: boolean;
  onToggle(): void;
  onOpen(): void;
};

const PENDING =
  "flex h-[13px] items-center rounded-[8px] bg-(--tracking-brand-btn) px-[5px] font-mono text-[10.5px] leading-[1.2] font-semibold text-white tabular-nums";

export const pendingBatchId = (agents: AgentsState | null, projectId: string): string | null =>
  agents?.projectAgents.find((p) => p.projectId === projectId && p.pendingBatchId !== null)?.pendingBatchId ??
  null;

export const signalCount = (agents: AgentsState | null, projectId: string): number =>
  agents?.signals.find((s) => s.projectId === projectId)?.open ?? 0;

function buttonLabel(signals: number, batch: string | null, pending: number): string {
  if (signals > 0) return `${frProjectAgent.button} · ${frSignals.button.signals(signals)}`;
  return batch === null
    ? frProjectAgent.button
    : `${frProjectAgent.button} · ${frProjectAgent.pending(pending)}`;
}

export function ProjectAgentButton({ projectId, agents, open, onToggle, onOpen }: Props) {
  const batch = pendingBatchId(agents, projectId);
  const pending = usePendingCount(projectId, batch);
  const signals = signalCount(agents, projectId);
  return (
    <span data-open={open || undefined} className="k-agent">
      <button
        type="button"
        aria-label={buttonLabel(signals, batch, pending)}
        aria-pressed={open}
        title={frProjectAgent.buttonTitle(shortcutLabel(["J"], isMac()))}
        className="k-focus"
        onClick={onToggle}
      >
        <Bot size={15} absoluteStrokeWidth />
        {frProjectAgent.button}
      </button>
      {signals > 0 ? (
        <button
          type="button"
          className="k-focus"
          aria-label={frProjectAgent.open}
          title={frSignals.button.signals(signals)}
          onClick={onOpen}
        >
          {signals}
        </button>
      ) : (
        pending > 0 &&
        !open && (
          <span aria-hidden data-pending className={PENDING}>
            {pending}
          </span>
        )
      )}
    </span>
  );
}
