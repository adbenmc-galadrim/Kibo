import type { AgentsState, Screen, TabTarget } from "@kibo/schema";
import {
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@kibo/sdk/ui/sidebar";
import { Bot, ListOrdered } from "lucide-react";
import { fr } from "../../i18n/fr";
import { SCREENS } from "../../tabs/screens";
import type { Link } from "../ProjectEntry";
import { isExecutionScreen } from "./execution-visibility";

const screenTarget = (screen: Screen): TabTarget => ({ kind: "screen", screen });

type AgentsEntryProps = { screen: Screen | null; agents: AgentsState | null; link: Link };

export function AgentsEntry({ screen, agents, link }: AgentsEntryProps) {
  const inAgents = isExecutionScreen(screen);
  const SkillsIcon = SCREENS.skills.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={inAgents} {...link(screenTarget("agents"))}>
        <Bot />
        <span>{fr.nav.agents}</span>
      </SidebarMenuButton>
      {agents && (
        <SidebarMenuBadge className="gap-1.5">
          {agents.host.used}
          {agents.runs.some((r) => r.state === "waiting_input") && (
            <span aria-hidden className="size-1.5 rounded-full bg-brand" />
          )}
        </SidebarMenuBadge>
      )}
      {inAgents && (
        <SidebarMenuSub>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={screen === "queue"}>
              <button type="button" {...link(screenTarget("queue"))}>
                <ListOrdered />
                <span>{fr.nav.queue}</span>
              </button>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={screen === "skills"}>
              <button type="button" {...link(screenTarget("skills"))}>
                <SkillsIcon />
                <span>{fr.nav.skills}</span>
              </button>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}
