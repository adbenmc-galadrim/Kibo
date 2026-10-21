import type { ProjectSnapshot } from "@kibo/schema";
import { useEffect, useMemo, useState } from "react";
import { useAgentList } from "../agents/catalog/use-agent-list";
import { client } from "../api";
import { projectQuestionLinks } from "../moments/QuestionText";
import { useHost } from "../shell/Host";
import { useAgentsState } from "../state/agents-context";
import { useRunLog } from "../state/use-run-log";
import { agentListItems } from "./agent-list";
import type { Decision } from "./BatchCard";
import { projectLabels } from "./batch-groups";
import { buildConversation, lastUserMessage, type PanelStatus, panelStatus } from "./conversation";
import { useSignals } from "./signals/use-signals";
import { useProjectAgent } from "./use-project-agent";

type Mode = { kind: "current" } | { kind: "past"; runId: string };

const CURRENT: Mode = { kind: "current" };

export function useAgentConversation(project: ProjectSnapshot, open: boolean) {
  const host = useHost();
  const projectId = project.meta.id;
  const [mode, setMode] = useState<Mode>(CURRENT);
  useEffect(() => {
    if (open) setMode(CURRENT);
  }, [open]);
  const current = useProjectAgent(projectId);
  const pastRunId = mode.kind === "past" ? mode.runId : undefined;
  const past = useProjectAgent(pastRunId ? projectId : null, pastRunId);
  const shown = mode.kind === "past" ? past : current;
  const view = shown.view;
  const readOnly = mode.kind === "past";
  const { log } = useRunLog(view?.run?.id ?? view?.session?.runId ?? null);
  const items = useMemo(
    () => buildConversation(log ?? [], view?.batches ?? [], view?.run ?? null),
    [log, view],
  );
  const agentList = useAgentList(projectId);
  const labels = useMemo(() => projectLabels(project, agentList.agents ?? []), [project, agentList.agents]);
  const runs = useAgentsState()?.runs;
  const links = useMemo(
    () =>
      projectQuestionLinks(project, runs ?? [], (id) =>
        host.openView("questions", projectId, { kind: "question", id }),
      ),
    [project, runs, host, projectId],
  );
  const signals = useSignals(projectId);
  const status: PanelStatus = readOnly ? "ready" : panelStatus(view?.run ?? null, null);
  const agents = useMemo(() => (current.view ? agentListItems(current.view) : []), [current.view]);

  const send = async (text: string) => {
    await client.rpc({ method: "sendProjectAgentMessage", projectId, text });
    current.reload();
  };
  const decide = async (batchId: string, d: Decision) => {
    const batch = await client.rpc({ method: "decideBatch", projectId, batchId, ...d });
    current.reload();
    return batch;
  };
  const reset = async () => {
    await client.rpc({ method: "resetProjectAgent", projectId });
    current.reload();
    setMode(CURRENT);
  };
  const retry = () => {
    const text = lastUserMessage(log ?? []);
    if (text) void send(text).catch((e: unknown) => console.error(e));
  };
  const openTicket = (key: string) => {
    const ticket = project.tickets.find((t) => t.key === key);
    if (ticket) host.openTicket(ticket.id);
  };
  const currentRunId = current.view?.session?.runId ?? null;
  const openAgent = (runId: string) => setMode(runId === currentRunId ? CURRENT : { kind: "past", runId });

  return {
    view,
    error: shown.error,
    readOnly,
    pastStartedAt: current.view?.past.find((s) => s.runId === pastRunId)?.startedAt ?? null,
    items,
    status,
    labels,
    links,
    signals: signals.view?.signals ?? [],
    agents,
    selected: pastRunId ?? currentRunId,
    canReset: current.view?.session != null,
    hasSession: view?.session != null,
    openAgent,
    back: () => setMode(CURRENT),
    send,
    decide,
    reset,
    retry,
    openTicket,
  };
}

export type AgentConversation = ReturnType<typeof useAgentConversation>;
