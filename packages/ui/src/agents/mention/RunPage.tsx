import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Label } from "@kibo/sdk/ui/label";
import { useId, useState } from "react";
import { frMoments } from "../../i18n/fr-moments";
import { usePref } from "../../lib/local-pref";
import { useHost } from "../../shell/Host";
import { useNow } from "../../state/use-agents";
import { DockPlan } from "../dock/DockPlan";
import { RunDetail } from "../RunDetail";
import { ProfileRuns } from "./ProfileRuns";
import { RunFeed } from "./RunFeed";
import { RunHeading } from "./RunHeading";
import { RunReportSection } from "./RunReportSection";
import { useRunView } from "./use-run-view";

export const REASONING_PREF = "kibo.run.reasoning";

const CARD = "grid content-start gap-3 rounded-lg border bg-card p-4";

function ReasoningToggle() {
  const id = useId();
  const [pref, setPref] = usePref(REASONING_PREF, "0");
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={pref === "1"} onCheckedChange={(v) => setPref(v === true ? "1" : "0")} />
      <Label htmlFor={id} className="text-sm font-normal">
        {frMoments.run.reasoning}
      </Label>
    </div>
  );
}

export function RunPage({ runId }: { runId: string }) {
  const t = frMoments.run;
  const host = useHost();
  const now = useNow();
  const [highlight, setHighlight] = useState<string | null>(null);
  const [reasoning] = usePref(REASONING_PREF, "0");
  const { agents, run, moments, shown, report } = useRunView(runId);
  if (!agents) return null;
  if (!run) return <p className="p-8 text-sm text-muted-foreground">{t.missing}</p>;
  return (
    <div className="grid content-start gap-5 p-6">
      <RunHeading
        run={run}
        onOpenTicket={(projectId, ticketId) => host.openTarget({ kind: "ticket", projectId, ticketId })}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)_20rem]">
        <ProfileRuns run={run} agents={agents} />
        <section aria-label={t.feed} className={CARD}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex-1 text-sm font-semibold">{t.feed}</h3>
            <ReasoningToggle />
          </div>
          <RunDetail
            run={run}
            resumable={agents.resumable.includes(run.id)}
            questions={agents.questions.find((q) => q.runId === run.id) ?? null}
            now={now}
          >
            <RunFeed
              run={run}
              runs={agents.runs}
              moments={moments}
              steps={shown?.plan ?? []}
              showReasoning={reasoning === "1"}
              highlightStep={highlight}
            />
          </RunDetail>
        </section>
        <aside className="grid content-start gap-4">
          {shown && (
            <div className={CARD}>
              <DockPlan shown={shown} moments={moments} current={highlight} onStep={setHighlight} />
            </div>
          )}
          <div className={CARD}>
            <RunReportSection runId={run.id} report={report} />
          </div>
        </aside>
      </div>
    </div>
  );
}
