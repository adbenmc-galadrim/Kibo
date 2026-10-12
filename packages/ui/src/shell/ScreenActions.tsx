import type { AgentsState, Screen } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
import { PauseAdmission } from "../agents/PauseAdmission";
import { fr } from "../i18n/fr";

type Props = {
  screen: Screen | null;
  agents: AgentsState | null;
  onNewAgent: () => void;
  onNewSkill: () => void;
};

function NewButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="h-7" onClick={onClick}>
      <Plus />
      {label}
    </Button>
  );
}

export function ScreenActions({ screen, agents, onNewAgent, onNewSkill }: Props) {
  if (screen === "agents") return <NewButton label={fr.nav.newAgent} onClick={onNewAgent} />;
  if (screen === "skills") return <NewButton label={fr.nav.newSkill} onClick={onNewSkill} />;
  if (screen === "queue" && agents) return <PauseAdmission paused={agents.host.paused} />;
  return null;
}
