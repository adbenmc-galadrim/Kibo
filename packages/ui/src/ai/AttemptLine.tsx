import type { ComponentDraft, RunState, RunView } from "@kibo/schema";
import { RunDot } from "@kibo/sdk";
import { fr } from "../i18n/fr";
import { frAgentBar } from "../i18n/fr-agent-bar";

type Props = { draft: ComponentDraft; run: RunView | null; outcome?: RunState };

export function AttemptLine({ draft, run, outcome }: Props) {
  const state = outcome ?? run?.state ?? null;
  const parts = [fr.ai.attempt(draft.attempts), run?.profileName, state ? frAgentBar.states[state] : null];
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {state && <RunDot state={state} />}
      <span>{parts.filter(Boolean).join(" · ")}</span>
    </p>
  );
}
