import type { ProjectAgentSessionView, ProjectAgentView } from "@kibo/schema";
import { formatClock } from "../agents/format";
import { frProjectAgent } from "../i18n/fr-project-agent";

export type AgentListItem = {
  runId: string;
  label: string;
  date: string;
  messages: number;
  current: boolean;
};

const t = frProjectAgent.list;
const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

const shortDay = (at: number): string => DAY.format(at);

const sameDay = (a: number, b: number): boolean => new Date(a).toDateString() === new Date(b).toDateString();

const shortDate = (at: number, now: number): string => (sameDay(at, now) ? formatClock(at) : shortDay(at));

export function agentLabel(session: Pick<ProjectAgentSessionView, "title" | "startedAt">): string {
  return session.title ?? t.untitled(shortDay(session.startedAt));
}

const toItem = (session: ProjectAgentSessionView, now: number, current: boolean): AgentListItem => ({
  runId: session.runId,
  label: agentLabel(session),
  date: shortDate(session.startedAt, now),
  messages: session.messages,
  current,
});

export function agentListItems(
  view: Pick<ProjectAgentView, "session" | "past">,
  now: number = Date.now(),
): AgentListItem[] {
  const past = [...view.past].sort((a, b) => b.startedAt - a.startedAt).map((s) => toItem(s, now, false));
  return view.session ? [toItem(view.session, now, true), ...past] : past;
}
