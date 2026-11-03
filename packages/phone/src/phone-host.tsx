import type { TabTarget } from "@kibo/schema";
import { type Host, HostProvider } from "@kibo/ui/host";
import type { ReactNode } from "react";
import type { PhoneTab } from "./route";
import type { Navigate } from "./use-route";

const TAB_OF_COMPONENT: Record<string, PhoneTab> = {
  graph: "graph",
  kanban: "kanban",
  planning: "planning",
  questions: "questions",
  overview: "dashboard",
};

function phoneHost(projectId: string, navigate: Navigate): Host {
  const openTab = (tab: PhoneTab) => navigate({ name: "tab", projectId, tab });
  const openTarget = (target: TabTarget) => {
    if (target.kind === "project") navigate({ name: "tab", projectId: target.projectId, tab: "graph" });
  };
  return {
    projectId,
    openTicket: (ticketId) => navigate({ name: "ticket", projectId, ticketId }),
    openSprint: () => openTab("planning"),
    openNewTicket: () => undefined,
    openFile: () => undefined,
    openView: (componentId) => {
      const tab = TAB_OF_COMPONENT[componentId];
      if (tab) openTab(tab);
    },
    openTarget,
    openProjectAgent: () => navigate({ name: "agent", projectId }),
  };
}

export function PhoneHost({
  projectId,
  navigate,
  children,
}: {
  projectId: string;
  navigate: Navigate;
  children: ReactNode;
}) {
  return <HostProvider host={phoneHost(projectId, navigate)}>{children}</HostProvider>;
}
