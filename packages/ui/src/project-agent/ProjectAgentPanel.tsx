import type { ProjectSnapshot } from "@kibo/schema";
import { Sheet, SheetContent } from "@kibo/sdk/ui/sheet";
import { useMemo, useState } from "react";
import { client } from "../api";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { useHost } from "../shell/Host";
import type { ProjectAgentTab } from "../shell/use-project-agent-panel";
import { useRunLog } from "../state/use-run-log";
import type { Decision } from "./BatchCard";
import { projectLabels } from "./batch-groups";
import { ComposeBox } from "./ComposeBox";
import { ConversationView } from "./ConversationView";
import { buildConversation, lastUserMessage, panelStatus } from "./conversation";
import { PanelHeader } from "./PanelHeader";
import { PanelTabs } from "./PanelTabs";
import { PastBanner, PastSessions } from "./PastSessions";
import { ResizeEdge } from "./ResizeEdge";
import { SessionsMenu } from "./SessionsMenu";
import { SignalBox } from "./signals/SignalBox";
import { boxSections } from "./signals/signal-sections";
import { useSignals } from "./signals/use-signals";
import { usePanelWidth } from "./use-panel-width";
import { useProjectAgent } from "./use-project-agent";

type Props = {
  open: boolean;
  project: ProjectSnapshot;
  tab: ProjectAgentTab;
  onTab(tab: ProjectAgentTab): void;
  onClose(): void;
};
type Mode = { kind: "current" } | { kind: "list" } | { kind: "past"; runId: string };

export function ProjectAgentPanel({ open, project, tab, onTab, onClose }: Props) {
  const host = useHost();
  const projectId = project.meta.id;
  const [width, setWidth] = usePanelWidth();
  const [mode, setMode] = useState<Mode>({ kind: "current" });
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
  const labels = useMemo(() => projectLabels(project), [project]);

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
  const back = () => setMode({ kind: "current" });
  const conversation = (
    <ConversationView
      items={items}
      readOnly={readOnly}
      labels={labels}
      signals={signals.view?.signals ?? []}
      onTicket={openTicket}
      onRetry={retry}
      onDecide={decide}
    />
  );

  return (
    <Sheet modal={false} open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="gap-0 p-0 sm:max-w-none"
        style={{ width, top: "var(--shell-top)", height: "auto" }}
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ResizeEdge width={width} onResize={setWidth} />
        <PanelHeader
          project={project.meta.name}
          status={panelStatus(readOnly ? null : (view?.run ?? null), readOnly ? null : pending)}
          menu={
            <SessionsMenu
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
