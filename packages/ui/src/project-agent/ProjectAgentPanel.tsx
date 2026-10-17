import type { ProjectSnapshot } from "@kibo/schema";
import { Sheet, SheetContent } from "@kibo/sdk/ui/sheet";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAgentList } from "../agents/catalog/use-agent-list";
import { client } from "../api";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { projectQuestionLinks, QuestionLinksContext } from "../moments/QuestionText";
import { useHost } from "../shell/Host";
import type { ProjectAgentTab } from "../shell/use-project-agent-panel";
import { keepLayerOnSkillEscape } from "../skill-complete/use-skill-complete";
import { useAgentsState } from "../state/agents-context";
import { useRunLog } from "../state/use-run-log";
import type { Decision } from "./BatchCard";
import { projectLabels } from "./batch-groups";
import { ComposeBox } from "./ComposeBox";
import { ConversationView } from "./ConversationView";
import { buildConversation, lastAgentText, lastUserMessage, panelStatus } from "./conversation";
import { PanelHeader } from "./PanelHeader";
import { PanelMenu } from "./PanelMenu";
import { PanelTabs } from "./PanelTabs";
import { PastBanner, PastSessions } from "./PastSessions";
import { ResizeEdge } from "./ResizeEdge";
import { SignalBox } from "./signals/SignalBox";
import { boxSections } from "./signals/signal-sections";
import { useSignals } from "./signals/use-signals";
import { TrackingView } from "./TrackingView";
import { usePanelWidth } from "./use-panel-width";
import { useProjectAgent } from "./use-project-agent";

const DOCK_VAR = "--project-agent-w";
const DOCK_RULE = 1;

type Props = {
  open: boolean;
  project: ProjectSnapshot;
  tab: ProjectAgentTab;
  onTab(tab: ProjectAgentTab): void;
  onClose(): void;
};
type Mode = { kind: "tracking" } | { kind: "current" } | { kind: "list" } | { kind: "past"; runId: string };

const TRACKING: Mode = { kind: "tracking" };
const CURRENT: Mode = { kind: "current" };

export function ProjectAgentPanel({ open, project, tab, onTab, onClose }: Props) {
  const host = useHost();
  const projectId = project.meta.id;
  const [width, setWidth] = usePanelWidth();
  const docked = width + DOCK_RULE;
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement.style;
    root.setProperty(DOCK_VAR, `${docked}px`);
    return () => {
      root.removeProperty(DOCK_VAR);
    };
  }, [open, docked]);
  const [mode, setMode] = useState<Mode>(tab === "signals" ? CURRENT : TRACKING);
  const tabNow = useRef(tab);
  tabNow.current = tab;
  useEffect(() => {
    if (open && tab === "signals") setMode(CURRENT);
  }, [open, tab]);
  useEffect(() => {
    if (open && tabNow.current !== "signals") setMode(TRACKING);
  }, [open]);
  const pastRunId = mode.kind === "past" ? mode.runId : undefined;
  const { view, error, reload } = useProjectAgent(projectId, pastRunId);
  const { log } = useRunLog(view?.run?.id ?? view?.session?.runId ?? null);
  const signals = useSignals(projectId);
  const openSignals = signals.view ? boxSections(signals.view).open.length : 0;
  const readOnly = mode.kind === "past";
  const pending = view?.batches.find((b) => b.status === "pending") ?? null;
  const items = useMemo(
    () => buildConversation(log ?? [], view?.batches ?? [], view?.run ?? null),
    [log, view],
  );
  const agentList = useAgentList(projectId);
  const labels = useMemo(() => projectLabels(project, agentList.agents ?? []), [project, agentList.agents]);
  const runs = useAgentsState()?.runs;
  const links = useMemo(
    () => projectQuestionLinks(project, runs ?? [], (id) => host.openView("questions", projectId, id)),
    [project, runs, host, projectId],
  );

  const send = async (text: string) => {
    await client.rpc({ method: "sendProjectAgentMessage", projectId, text });
    reload();
  };
  const decide = async (batchId: string, d: Decision) => {
    await client.rpc({ method: "decideBatch", projectId, batchId, ...d });
    reload();
  };
  const reset = async () => {
    await client.rpc({ method: "resetProjectAgent", projectId });
    reload();
  };
  const openTicket = (key: string) => {
    const ticket = project.tickets.find((t) => t.key === key);
    if (ticket) host.openTicket(ticket.id);
  };
  const retry = () => {
    const text = lastUserMessage(log ?? []);
    if (text) void send(text).catch((e: unknown) => console.error(e));
  };
  const back = () => setMode(TRACKING);
  const show = (next: ProjectAgentTab) => {
    setMode(CURRENT);
    onTab(next);
  };
  const tracking = () => {
    setMode(TRACKING);
    onTab("conversation");
  };
  const conversation = (
    <QuestionLinksContext.Provider value={links}>
      <ConversationView
        items={items}
        readOnly={readOnly}
        labels={labels}
        signals={signals.view?.signals ?? []}
        onTicket={openTicket}
        onRetry={retry}
        onDecide={decide}
      />
    </QuestionLinksContext.Provider>
  );

  return (
    <Sheet modal={false} open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="box-content gap-0 bg-(--tracking-panel) p-0 sm:max-w-none"
        style={{ width, top: "var(--tabbar-h)", height: "auto" }}
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={keepLayerOnSkillEscape}
      >
        <ResizeEdge width={width} onResize={setWidth} />
        <PanelHeader
          project={project.meta.name}
          status={panelStatus(readOnly ? null : (view?.run ?? null), readOnly ? null : pending)}
          lastTurnAt={readOnly ? null : (view?.session?.lastTurnAt ?? null)}
          menu={
            <PanelMenu
              signals={openSignals}
              {...(mode.kind === "tracking" ? {} : { onTracking: tracking })}
              onConversation={() => show("conversation")}
              onSignals={() => show("signals")}
              onReset={reset}
              onPast={() => setMode({ kind: "list" })}
              onMemory={() => host.openView("notes")}
            />
          }
          onClose={onClose}
        />
        {error && (
          <p role="alert" className="border-b px-3 py-2 text-xs text-destructive">
            {frProjectAgent.loadFailed}
          </p>
        )}
        {mode.kind === "tracking" && (
          <TrackingView
            projectId={projectId}
            projectName={project.meta.name}
            summary={lastAgentText(items)}
            batch={pending}
            labels={labels}
            onTicket={openTicket}
            onDecide={decide}
            onSend={send}
          />
        )}
        {mode.kind === "list" && (
          <PastSessions
            sessions={view?.past ?? []}
            onOpen={(runId) => setMode({ kind: "past", runId })}
            onBack={back}
          />
        )}
        {mode.kind === "past" && (
          <>
            <PastBanner onBack={back} />
            {conversation}
          </>
        )}
        {mode.kind === "current" && (
          <PanelTabs
            tab={tab}
            open={openSignals}
            onTab={onTab}
            conversation={
              <>
                {conversation}
                <ComposeBox
                  projectId={projectId}
                  placeholder={
                    view?.session
                      ? frProjectAgent.compose.placeholder
                      : frProjectAgent.compose.empty(project.meta.name)
                  }
                  onSend={send}
                />
              </>
            }
            signals={
              <SignalBox
                projectId={projectId}
                signals={signals}
                batches={view?.batches ?? []}
                onTicket={openTicket}
              />
            }
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
