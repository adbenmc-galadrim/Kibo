import type { AgentsState } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Sparkles } from "lucide-react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { isMac, shortcutLabel } from "../lib/shortcut-label";

type Props = { projectId: string; agents: AgentsState | null; open: boolean; onToggle(): void };

export const hasPendingBatch = (agents: AgentsState | null, projectId: string): boolean =>
  agents?.projectAgents.some((p) => p.projectId === projectId && p.pendingBatchId !== null) ?? false;

export function ProjectAgentButton({ projectId, agents, open, onToggle }: Props) {
  const pending = hasPendingBatch(agents, projectId);
  const label = pending ? `${frProjectAgent.button} · ${frProjectAgent.pending}` : frProjectAgent.button;
  return (
    <Button
      variant={open ? "secondary" : "ghost"}
      size="sm"
      className="relative h-7"
      aria-label={label}
      aria-pressed={open}
      title={frProjectAgent.buttonTitle(shortcutLabel(["J"], isMac()))}
      onClick={onToggle}
    >
      <Sparkles className="text-brand-strong dark:text-brand" />
      {frProjectAgent.button}
      {pending && (
        <span
          className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-brand ring-2 ring-background"
          aria-hidden
        />
      )}
    </Button>
  );
}
