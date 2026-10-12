import { Button } from "@kibo/sdk/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@kibo/sdk/ui/sheet";
import { Maximize2, X } from "lucide-react";
import { useState } from "react";
import { fr } from "../../i18n/fr";
import { frMoments } from "../../i18n/fr-moments";
import { RunSkillReviews } from "../../moments/SkillReviewsBlock";
import { ResizeEdge } from "../../project-agent/ResizeEdge";
import { usePanelWidth } from "../../project-agent/use-panel-width";
import { navigateTo } from "../../route";
import { DockPlan } from "../dock/DockPlan";
import { RunList } from "./ProfileRuns";
import { RunFeed } from "./RunFeed";
import { RunHeading } from "./RunHeading";
import { RunReportSection } from "./RunReportSection";
import { useRunView } from "./use-run-view";

export const RUN_PANEL_WIDTH_KEY = "kibo.runPanel.width";
const RUN_PANEL_DEFAULT = 520;

type Props = { runId: string; onClose(): void; onOpenTicket(projectId: string, ticketId: string): void };

const SECTION_TITLE = "text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

function PanelBody({ runId, onClose, onOpenTicket }: Props) {
  const t = frMoments.run;
  const { agents, run, moments, shown, report, loading, failed } = useRunView(runId);
  const [highlight, setHighlight] = useState<string | null>(null);
  const close = (
    <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label={t.close} onClick={onClose}>
      <X />
    </Button>
  );
  const title = (
    <SheetTitle className="sr-only">
      {run ? fr.tabs.runTitle(run.label, run.ticketKey) : fr.tabs.run}
    </SheetTitle>
  );
  if (!agents || !run)
    return (
      <div className="flex items-center justify-between gap-2 p-3">
        {title}
        {agents && <p className="text-sm text-muted-foreground">{t.missing}</p>}
        <span className="flex-1" />
        {close}
      </div>
    );
  const expand = () => {
    navigateTo({ kind: "run", runId: run.id });
    onClose();
  };
  return (
    <>
      {title}
      <div className="border-b p-3">
        <RunHeading run={run} onOpenTicket={onOpenTicket}>
          <Button size="sm" variant="outline" className="shrink-0" onClick={expand}>
            <Maximize2 />
            {t.expand}
          </Button>
          {close}
        </RunHeading>
      </div>
      <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto p-3">
        {shown && <DockPlan shown={shown} moments={moments} current={highlight} onStep={setHighlight} />}
        <section aria-label={t.feed} className="grid gap-2 border-t pt-3">
          <h3 className={SECTION_TITLE}>{t.feed}</h3>
          <RunFeed
            run={run}
            runs={agents.runs}
            moments={moments}
            steps={shown?.plan ?? []}
            highlightStep={highlight}
            loading={loading}
            failed={failed}
          />
        </section>
        <RunReportSection runId={run.id} report={report} />
        <RunSkillReviews runId={run.id} moments={moments} />
        <section className="grid gap-2">
          <h3 className={SECTION_TITLE}>{t.ticketRuns}</h3>
          <RunList
            label={t.ticketRuns}
            runs={agents.runs.filter((r) => r.ticketId !== null && r.ticketId === run.ticketId)}
            current={run.id}
            agents={agents}
          />
        </section>
      </div>
    </>
  );
}

export function RunSidePanel(props: Props) {
  const [width, setWidth] = usePanelWidth(RUN_PANEL_WIDTH_KEY, RUN_PANEL_DEFAULT);
  return (
    <Sheet modal={false} open onOpenChange={(open) => !open && props.onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        className="gap-0 p-0 sm:max-w-none"
        style={{ width, top: "var(--shell-top)", height: "auto" }}
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ResizeEdge width={width} onResize={setWidth} />
        <PanelBody {...props} />
      </SheetContent>
    </Sheet>
  );
}
