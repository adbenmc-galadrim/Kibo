import { Button } from "@kibo/sdk/ui/button";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Label } from "@kibo/sdk/ui/label";
import { ScrollPane } from "@kibo/sdk/ui/scroll-pane";
import { useId, useRef, useState } from "react";
import { fr } from "../../i18n/fr";
import { frMoments } from "../../i18n/fr-moments";
import { usePref } from "../../lib/local-pref";
import { RunSkillReviews } from "../../moments/SkillReviewsBlock";
import { ParallelWorkSection } from "../../overlaps/ParallelWorkSection";
import { useHost } from "../../shell/Host";
import { DockPlan } from "../dock/DockPlan";
import { ReviewButton } from "../ReviewButton";
import { RunReply, RunStop } from "../RunDetail";
import { useFollowBottom } from "../use-follow-bottom";
import { ProfileRuns } from "./ProfileRuns";
import { RunFeed } from "./RunFeed";
import { RunHeading } from "./RunHeading";
import { RunReportSection } from "./RunReportSection";
import { useRunView } from "./use-run-view";

export const REASONING_PREF = "kibo.run.reasoning";

const CARD = "grid content-start gap-3 rounded-lg border bg-card p-4";
const FEED_CARD = "flex min-h-0 flex-col gap-3 rounded-lg border bg-card p-4";

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

function AnswerButton({ onAnswer }: { onAnswer(): void }) {
  return (
    <Button size="sm" className="bg-brand-strong text-white hover:bg-brand-strong/90" onClick={onAnswer}>
      {fr.agents.answer}
    </Button>
  );
}

export function RunPage({ runId }: { runId: string }) {
  const t = frMoments.run;
  const host = useHost();
  const reply = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [reasoning] = usePref(REASONING_PREF, "0");
  const { agents, run, moments, shown, report, loading, failed } = useRunView(runId);
  const follow = useFollowBottom<HTMLElement>(loading ? 0 : moments.length);
  if (!agents) return null;
  if (!run) return <p className="p-8 text-sm text-muted-foreground">{t.missing}</p>;
  const focusReply = () => reply.current?.querySelector("input")?.focus();
  return (
    <div className="grid content-start gap-5 p-6 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <RunHeading
        run={run}
        onOpenTicket={(projectId, ticketId) => host.openTarget({ kind: "ticket", projectId, ticketId })}
      >
        <div className="flex shrink-0 items-center gap-2">
          <ReviewButton run={run} />
          {run.state === "waiting_input" && <AnswerButton onAnswer={focusReply} />}
          <RunStop run={run} />
        </div>
      </RunHeading>
      <div className="grid items-start gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[15rem_minmax(0,1fr)_20rem] lg:items-stretch">
        <ScrollPane>
          <ProfileRuns run={run} agents={agents} />
        </ScrollPane>
        <section aria-label={t.feed} className={FEED_CARD}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex-1 text-sm font-semibold">{t.feed}</h3>
            <ReasoningToggle />
          </div>
          <ScrollPane
            ref={follow.ref}
            onScroll={follow.onScroll}
            className="-mx-1 max-h-[60dvh] px-1 lg:max-h-none lg:flex-1"
          >
            <RunFeed
              run={run}
              runs={agents.runs}
              moments={moments}
              steps={shown?.plan ?? []}
              showReasoning={reasoning === "1"}
              highlightStep={highlight}
              loading={loading}
              failed={failed}
            />
          </ScrollPane>
          <div ref={reply} className="grid shrink-0 gap-3">
            <RunReply
              run={run}
              resumable={agents.resumable.includes(run.id)}
              questions={agents.questions.find((q) => q.runId === run.id) ?? null}
            />
          </div>
        </section>
        <ScrollPane as="aside" className="grid content-start gap-4">
          {run.kind === "ticket" && (
            <div className={CARD}>
              <ParallelWorkSection runId={run.id} />
            </div>
          )}
          {shown && (
            <div className={CARD}>
              <DockPlan shown={shown} moments={moments} current={highlight} onStep={setHighlight} />
            </div>
          )}
          <div className={CARD}>
            <RunReportSection runId={run.id} report={report} />
            <RunSkillReviews runId={run.id} moments={moments} />
          </div>
        </ScrollPane>
      </div>
    </div>
  );
}
