import type { AgentsState } from "@kibo/schema";
import { Bot } from "lucide-react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { isMac, shortcutLabel } from "../lib/shortcut-label";
import { usePendingCount } from "./use-pending-count";

type Props = {
  projectId: string;
  agents: AgentsState | null;
  open: boolean;
  onToggle(): void;
};

const PENDING =
  "flex h-[13px] items-center rounded-[8px] bg-(--tracking-brand-btn) px-[5px] font-mono text-[10.5px] leading-[1.2] font-semibold text-white tabular-nums";

const pendingBatchId = (agents: AgentsState | null, projectId: string): string | null =>
  agents?.projectAgents.find((p) => p.projectId === projectId && p.pendingBatchId !== null)?.pendingBatchId ??
  null;

function buttonLabel(batch: string | null, pending: number): string {
  return batch === null
    ? frProjectAgent.button
    : `${frProjectAgent.button} · ${frProjectAgent.pending(pending)}`;
}

export function ProjectAgentButton({ projectId, agents, open, onToggle }: Props) {
  const batch = pendingBatchId(agents, projectId);
  const pending = usePendingCount(projectId, batch);
  return (
    <span data-open={open || undefined} className="k-agent">
      <button
        type="button"
        aria-label={buttonLabel(batch, pending)}
        aria-pressed={open}
        title={frProjectAgent.buttonTitle(shortcutLabel(["J"], isMac()))}
        className="k-focus"
        onClick={onToggle}
      >
        <Bot size={15} absoluteStrokeWidth />
        {frProjectAgent.button}
      </button>
      {pending > 0 && !open && (
        <span aria-hidden data-pending className={PENDING}>
          {pending}
        </span>
      )}
    </span>
  );
}
