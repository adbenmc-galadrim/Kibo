import type { ProjectSnapshot } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Sheet, SheetContent } from "@kibo/sdk/ui/sheet";
import { useEffect, useState } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { keepLayerOnSkillEscape } from "../skill-complete/use-skill-complete";
import { AgentList } from "./AgentList";
import { NewAgentConfirm } from "./NewAgentButton";
import { PanelConversation } from "./PanelConversation";
import { PanelHeader } from "./PanelHeader";
import { ResizeEdge } from "./ResizeEdge";
import { useAgentConversation } from "./use-agent-conversation";
import { usePanelDock } from "./use-panel-dock";
import { usePanelLayout, WIDE_WIDTH } from "./use-panel-layout";
import { usePanelWidth } from "./use-panel-width";

type Props = { open: boolean; project: ProjectSnapshot; onClose(): void };

export function ProjectAgentPanel({ open, project, onClose }: Props) {
  const [width, setWidth] = usePanelWidth();
  const layout = usePanelLayout();
  const effectiveWidth = layout.wide ? WIDE_WIDTH : width;
  const { overlay } = usePanelDock(open, effectiveWidth, layout.wide);
  const [listOpen, setListOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (open) setListOpen(false);
  }, [open]);
  const chat = useAgentConversation(project, open);
  const listShown = layout.wide ? layout.list : listOpen;

  const toggleList = () => (layout.wide ? layout.setList(!layout.list) : setListOpen(!listOpen));
  const toggleWide = () => {
    setListOpen(false);
    layout.setWide(!layout.wide);
  };
  const openAgent = (runId: string) => {
    setListOpen(false);
    chat.openAgent(runId);
  };
  const reset = async () => {
    await chat.reset();
    setListOpen(false);
  };
  const list = (onCloseList?: () => void) => (
    <AgentList
      items={chat.agents}
      selected={chat.selected}
      canReset={chat.canReset}
      onOpen={openAgent}
      onNew={() => setConfirming(true)}
      {...(onCloseList ? { onClose: onCloseList } : {})}
    />
  );
  const conversation = (
    <PanelConversation
      projectId={project.meta.id}
      projectName={project.meta.name}
      chat={chat}
      onNew={() => setConfirming(true)}
    />
  );

  return (
    <Sheet modal={false} open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        data-overlay={overlay}
        className={cn("box-content gap-0 bg-(--tracking-panel) p-0 sm:max-w-none", overlay && "shadow-2xl")}
        style={{ width: effectiveWidth, top: "var(--tabbar-h)", height: "auto" }}
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={keepLayerOnSkillEscape}
      >
        {!layout.wide && <ResizeEdge width={width} onResize={setWidth} />}
        <PanelHeader
          project={project.meta.name}
          wide={layout.wide}
          listShown={listShown}
          canReset={chat.canReset}
          onList={toggleList}
          onNew={() => setConfirming(true)}
          onWide={toggleWide}
          onClose={onClose}
        />
        {chat.error && (
          <p role="alert" className="border-b px-3 py-2 text-xs text-destructive">
            {frProjectAgent.loadFailed}
          </p>
        )}
        {layout.wide ? (
          <div
            className={cn(
              "grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]",
              layout.list && "grid-cols-[210px_minmax(0,1fr)]",
            )}
          >
            {layout.list && list()}
            {conversation}
          </div>
        ) : (
          <div className="relative flex min-h-0 flex-1 flex-col">
            {conversation}
            {listOpen && (
              <div className="absolute inset-0 z-10 flex flex-col bg-background">
                {list(() => setListOpen(false))}
              </div>
            )}
          </div>
        )}
        <NewAgentConfirm open={confirming} onOpenChange={setConfirming} onReset={reset} />
      </SheetContent>
    </Sheet>
  );
}
