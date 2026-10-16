import type { AgentsState, Screen, TabTarget } from "@kibo/schema";
import { Bot, ListOrdered } from "lucide-react";
import { fr } from "../../i18n/fr";
import { SCREENS } from "../../tabs/screens";
import type { Link } from "../ProjectEntry";
import { isExecutionScreen } from "./execution-visibility";
import { NavRow } from "./NavRow";

const screenTarget = (screen: Screen): TabTarget => ({ kind: "screen", screen });

type AgentsEntryProps = { screen: Screen | null; agents: AgentsState | null; link: Link };

export function AgentsEntry({ screen, agents, link }: AgentsEntryProps) {
  const inAgents = isExecutionScreen(screen);
  const waiting = agents?.runs.some((r) => r.state === "waiting_input") ?? false;
  return (
    <>
      <NavRow
        icon={Bot}
        label={fr.nav.agents}
        active={screen === "agents"}
        count={agents ? String(agents.host.used) : null}
        trail={waiting && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand" />}
        {...link(screenTarget("agents"))}
      />
      {inAgents && (
        <>
          <NavRow
            nested
            icon={ListOrdered}
            label={fr.nav.queue}
            active={screen === "queue"}
            {...link(screenTarget("queue"))}
          />
          <NavRow
            nested
            icon={SCREENS.skills.icon}
            label={fr.nav.skills}
            active={screen === "skills"}
            {...link(screenTarget("skills"))}
          />
        </>
      )}
    </>
  );
}
