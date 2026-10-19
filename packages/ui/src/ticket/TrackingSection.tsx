import {
  branchRefOf,
  type CiRun,
  type CiTone,
  DELIVERY_STEP_LABELS,
  type GithubPrRef,
  liveReview,
  type ProjectEvent,
  type TicketView,
} from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { CircleX, FolderOpen, GitBranch, GitPullRequest } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "../i18n/fr";
import { frTicketTracking as t } from "../i18n/fr-ticket-tracking";
import { useOptionalHost } from "../shell/Host";
import { frRefs } from "../shell/sheet/fr-refs";
import { GithubRefs } from "../shell/sheet/lazy-sections";
import { CopyBranchCommandButton } from "./CopyCommandButton";
import {
  ciDetail,
  clockOf,
  durationLabel,
  isDeclared,
  lastEvent,
  mainPr,
  nextStepLabel,
  stepLine,
  whenLabel,
} from "./tracking-model";

type Props = {
  ticket: TicketView;
  ciRuns: readonly CiRun[];
  events: readonly ProjectEvent[];
  now: number;
  repo?: boolean;
};

const BADGE = "inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium";
const CI_BADGE: Record<CiTone, string> = {
  ok: "bg-(--tracking-green-soft) text-(--tracking-green)",
  error: "bg-(--tracking-red-soft) text-(--tracking-red)",
  running: "bg-(--tracking-amber-soft) text-(--tracking-amber)",
  neutral: "bg-(--tracking-muted) text-muted-foreground",
};
const REVIEW_BADGE: Record<GithubPrRef["review"], string> = {
  none: "",
  approved: "bg-(--tracking-green-soft) text-(--tracking-green)",
  changes_requested: "bg-(--tracking-amber-soft) text-(--tracking-amber)",
  review_required: "bg-(--tracking-muted) text-muted-foreground",
};
const LINK = "underline-offset-2 hover:underline";
const DIM = "text-muted-foreground";

const issuesOf = (ticket: TicketView): TicketView => ({
  ...ticket,
  externalRefs: ticket.externalRefs.filter((r) => r.kind === "github_issue" && r.number !== null),
});

const prTitle = (pr: GithubPrRef): string =>
  pr.state === "merged" && pr.base !== null ? frRefs.mergedInto(pr.base) : fr.ticket.prState[pr.state];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className={DIM}>{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</dd>
    </>
  );
}

function StepBar({ step }: { step: number }) {
  return (
    <span aria-hidden className="flex items-center gap-0.5">
      {DELIVERY_STEP_LABELS.map((label, i) => (
        <span
          key={label}
          className={cn(
            "h-3 w-[5px] rounded-[1px]",
            i < step ? "bg-(--tracking-mfg)" : i === step ? "bg-(--tracking-brand)" : "bg-border",
          )}
        />
      ))}
    </span>
  );
}

function EmptyTracking({ ticketKey, repo }: { ticketKey: string | null; repo: boolean }) {
  const host = useOptionalHost();
  if (repo)
    return (
      <div className="grid gap-2">
        <p className={DIM}>{t.empty}</p>
        {ticketKey && <CopyBranchCommandButton ticketKey={ticketKey} />}
      </div>
    );
  return (
    <div className="grid gap-2">
      <p className={DIM}>{t.noRepo}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-[25px] w-fit text-xs"
          onClick={() => host?.editProject?.({ field: "folder" })}
        >
          <FolderOpen />
          {t.chooseFolder}
        </Button>
        {ticketKey && <CopyBranchCommandButton ticketKey={ticketKey} secondary />}
      </div>
    </div>
  );
}

function PrRows({ pr, ciRuns, events, now }: Omit<Props, "ticket" | "repo"> & { pr: GithubPrRef }) {
  const opened = lastEvent(events, "pr_opened", pr.number);
  const reviewed = lastEvent(events, "pr_review", pr.number);
  const shown = liveReview(pr);
  const review = t.review[shown];
  const ci = ciDetail(pr, ciRuns, events);
  return (
    <>
      <Row label={t.prRow}>
        <GitPullRequest aria-hidden className="size-3.5 text-(--tracking-purple)" />
        <a
          href={pr.url}
          target="_blank"
          rel="noreferrer noopener"
          title={prTitle(pr)}
          className={cn("font-mono font-medium", LINK)}
        >
          {`#${pr.number}`}
        </a>
        <span className={DIM}>
          {t.prSince(fr.ticket.prState[pr.state], opened ? whenLabel(opened.at, now) : null)}
        </span>
      </Row>
      {review && (
        <Row label={t.reviewRow}>
          <span className={cn(BADGE, REVIEW_BADGE[shown])}>{review}</span>
          {reviewed && <span className={DIM}>{clockOf(reviewed.at)}</span>}
        </Row>
      )}
      <Row label={t.ciRow}>
        {ci ? (
          <>
            <span className={cn(BADGE, CI_BADGE[ci.tone])}>
              {ci.tone === "error" && <CircleX aria-hidden className="size-3" />}
              {t.ci[ci.tone]}
            </span>
            <span className={DIM}>
              {ci.url ? (
                <a href={ci.url} target="_blank" rel="noreferrer noopener" className={LINK}>
                  {t.job(ci.job, ci.at === null ? null : clockOf(ci.at)) || t.seeChecks}
                </a>
              ) : (
                t.job(ci.job, ci.at === null ? null : clockOf(ci.at))
              )}
            </span>
          </>
        ) : (
          <span className={DIM}>{t.noCi}</span>
        )}
      </Row>
    </>
  );
}

export function TrackingSection({ ticket, ciRuns, events, now, repo = true }: Props) {
  const branch = branchRefOf(ticket.externalRefs);
  const pr = mainPr(ticket.externalRefs);
  const issues = issuesOf(ticket);
  const { session, delivery } = ticket;
  const empty = !branch && !pr && !session && !delivery && issues.externalRefs.length === 0;
  const next = delivery ? nextStepLabel(delivery.step) : null;
  return (
    <section aria-labelledby={`tracking-${ticket.id}`} className="grid gap-2.5 text-[12.5px]">
      <p className="flex items-baseline gap-2">
        <span id={`tracking-${ticket.id}`} className="text-[13px] font-semibold">
          {t.section}
        </span>
        <span className={DIM}>{t.sectionHint}</span>
      </p>
      {empty ? (
        <EmptyTracking ticketKey={ticket.key} repo={repo} />
      ) : (
        <dl className="grid grid-cols-[106px_1fr] items-center gap-y-3">
          {branch && (
            <Row label={t.branch}>
              <GitBranch aria-hidden className="size-3.5 text-(--tracking-blue)" />
              <span className="font-mono">{branch.branch}</span>
              {branch.base && (
                <>
                  <span className={DIM}>{t.on}</span>
                  <span className="font-mono">{branch.base}</span>
                </>
              )}
              {isDeclared(events, branch.branch) && <span className={DIM}>{t.declared}</span>}
            </Row>
          )}
          {pr && <PrRows pr={pr} ciRuns={ciRuns} events={events} now={now} />}
          {session && (
            <Row label={t.session}>
              <span
                aria-hidden
                className="grid size-3 place-items-center rounded-full bg-(--tracking-brand)/20"
              >
                <span className="size-1.5 rounded-full bg-(--tracking-brand)" />
              </span>
              <span className="font-medium text-(--tracking-brand-text)">
                {t.sessionLine(session.tool, durationLabel(now - session.startedAt))}
              </span>
            </Row>
          )}
          {delivery && (
            <Row label={t.step}>
              <StepBar step={delivery.step} />
              <span>{stepLine(delivery)}</span>
              {next && <span className={DIM}>{t.next(next)}</span>}
            </Row>
          )}
          {issues.externalRefs.length > 0 && (
            <Row label={t.issues}>
              <GithubRefs ticket={issues} />
            </Row>
          )}
        </dl>
      )}
    </section>
  );
}
