import type { AgentsState, Screen } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
import { PauseAdmission } from "../agents/PauseAdmission";
import { fr } from "../i18n/fr";

type Props = { screen: Screen | null; agents: AgentsState | null; onNewProfile: () => void };

export function ScreenActions({ screen, agents, onNewProfile }: Props) {
  if (screen === "agents") {
    return (
      <Button variant="outline" size="sm" className="h-7" onClick={onNewProfile}>
        <Plus />
        {fr.agentsPage.newProfile}
      </Button>
    );
  }
  if (screen === "queue" && agents) return <PauseAdmission paused={agents.host.paused} />;
  return null;
}
