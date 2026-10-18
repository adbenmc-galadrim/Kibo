import type { TicketView } from "@kibo/schema";
import {
  copyDeliveryCommand,
  type KiboSdk,
  type ProjectInfo,
  useEntities,
  useQuestionRecipients,
  useSdk,
} from "@kibo/sdk";
import { useComponentSettings } from "@kibo/sdk/hooks/use-component-settings";
import { useEffect, useState } from "react";
import { gettingStarted } from "./getting-started-model";
import { type OverviewHandlers, OverviewView } from "./OverviewView";
import { overviewModel } from "./overview-model";

const MINUTE = 60_000;
const pad = (n: number) => String(n).padStart(2, "0");
export const localToday = (now: number): string => {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function useProjectInfo(sdk: KiboSdk): ProjectInfo | null {
  const [project, setProject] = useState<ProjectInfo | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      sdk.project.get().then(
        (info) => {
          if (alive) setProject(info);
        },
        (e: unknown) => console.warn("[overview] project info unavailable", e),
      );
    void load();
    const stop = sdk.project.subscribe(() => void load());
    return () => {
      alive = false;
      stop();
    };
  }, [sdk]);
  return project;
}

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
    onOpenPlanning: () => sdk.openView("planning"),
  };
}

export function Overview() {
  const sdk = useSdk();
  const now = useNow();
  const project = useProjectInfo(sdk);
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
    today: localToday(now),
    now,
  };
  return (
    <OverviewView
      project={project}
      model={overviewModel(input)}
      activity={input}
      start={project === null ? null : gettingStarted(project, tickets, copied)}
      handlers={handlersOf(sdk, agentExecution, tickets, () => setCopied(true))}
    />
  );
}
