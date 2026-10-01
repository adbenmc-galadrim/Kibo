import type { AgentsState } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Sparkles } from "lucide-react";
import { fr } from "../i18n/fr";
import { indicatorState, isActiveDraft } from "../state/draft-activity";
import { useComponentDrafts } from "../state/use-component-drafts";

type Props = { agents: AgentsState | null; onOpen(): void };

export function CreationsIndicator({ agents, onOpen }: Props) {
  const drafts = useComponentDrafts().drafts ?? [];
  const { visible, awaiting, busy } = indicatorState(drafts, agents?.runs ?? []);
  if (!visible) return null;
  const label = fr.header.creations(awaiting, drafts.filter(isActiveDraft).length - awaiting);
  return (
    <Button
      size="icon"
      variant="ghost"
      className="relative size-7"
      aria-label={label}
      title={label}
      data-busy={busy}
      onClick={onOpen}
    >
      <Sparkles className={busy ? "text-brand motion-safe:animate-pulse" : undefined} />
      {awaiting > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-3.5 place-items-center rounded-full bg-brand px-0.5 text-3xs font-semibold text-white">
          {awaiting}
        </span>
      )}
    </Button>
  );
}
