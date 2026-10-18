import type { TicketView } from "@kibo/schema";
import { copyDeliveryCommand, type KiboSdk, useEntities, useQuestionRecipients, useSdk } from "@kibo/sdk";
import { useComponentSettings } from "@kibo/sdk/hooks/use-component-settings";
import { useProject } from "@kibo/sdk/hooks/use-project";
import { useEffect, useState } from "react";
import { gettingStarted } from "./getting-started-model";
import { type OverviewHandlers, OverviewView } from "./OverviewView";
import { overviewModel } from "./overview-model";

const MINUTE = 60_000;
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function handlersOf(
  sdk: KiboSdk,
  execution: OverviewHandlers["execution"],
  tickets: readonly TicketView[],
  onCopied: () => void,
): OverviewHandlers {
  return {
    execution,
    copy: async (ticketId) => {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (ticket === undefined) return;
      await copyDeliveryCommand(sdk, ticket);
      onCopied();
    },
    deliver: async (ticketId) => {
      await sdk.runs.deliver(ticketId);
    },
    onOpenTicket: (id) => sdk.openTicket(id),
    onOpenSprint: (id) => sdk.sprints.open(id),
    onOpenQuestion: (id) => sdk.openView("questions", { question: id }),
    onOpenQuestions: () => sdk.openView("questions"),
    onNewFeature: () => sdk.openView("planning", { intent: { kind: "newFeature" } }),
    onChooseFolder: () => sdk.project.edit({ field: "folder" }),
  };
}

export function Overview() {
  const sdk = useSdk();
  const now = useNow();
  const project = useProject();
  const [copied, setCopied] = useState(false);
  const { tracking, agentExecution } = useComponentSettings();
  const recipients = useQuestionRecipients();
  const { data: tickets } = useEntities("ticket");
  const { data: links } = useEntities("link");
  const { data: workflow } = useEntities("status");
  const { data: sprints } = useEntities("sprint");
  const { data: questions } = useEntities("question");
  const { data: events } = useEntities("project_event");
  const { data: ciRuns } = useEntities("ci_run");
  if (project === null) return null;
  const input = {
    tickets,
    links,
    sprints,
    questions,
    events,
    ciRuns,
    recipients,
    workflow,
    tracking,
    today: project.today,
    now,
  };
  return (
    <OverviewView
      project={project}
      model={overviewModel(input)}
      activity={input}
      start={gettingStarted(project, tickets, copied)}
      handlers={handlersOf(sdk, agentExecution, tickets, () => setCopied(true))}
    />
  );
}
