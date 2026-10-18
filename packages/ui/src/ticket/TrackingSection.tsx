import {
  branchRefOf,
  type CiRun,
  type CiTone,
  type GithubPrRef,
  prCiTone,
  type TicketView,
} from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import type { ReactNode } from "react";
import { fr } from "../i18n/fr";
import { frTicketTracking as t } from "../i18n/fr-ticket-tracking";
import { frRefs } from "../shell/sheet/fr-refs";
import { GithubRefs } from "../shell/sheet/lazy-sections";
import { ciJobUrl, durationLabel, mainPr, stepLine } from "./tracking-model";

type Props = { ticket: TicketView; ciRuns: readonly CiRun[]; now: number };

const DOT: Record<CiTone, string> = {
  ok: "bg-(--tracking-green)",
  error: "bg-(--tracking-red)",
  running: "bg-(--tracking-amber)",
  neutral: "bg-(--tracking-faint)",
};
const LINK = "underline-offset-2 hover:underline";

const issuesOf = (ticket: TicketView): TicketView => ({
  ...ticket,
  externalRefs: ticket.externalRefs.filter((r) => r.kind === "github_issue" && r.number !== null),
});

const prTitle = (pr: GithubPrRef): string =>
  pr.state === "merged" && pr.base !== null ? frRefs.mergedInto(pr.base) : fr.ticket.prState[pr.state];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function PrLine({ pr }: { pr: GithubPrRef }) {
  const review = t.review[pr.review];
  return (
    <span>
      <a
        href={pr.url}
        target="_blank"
        rel="noreferrer noopener"
        title={prTitle(pr)}
        className={cn("font-mono", LINK)}
      >
        {`#${pr.number}`}
      </a>
      {` · ${fr.ticket.prState[pr.state]}`}
      {review && ` · ${review}`}
    </span>
  );
}

function CiLine({ pr, runs }: { pr: GithubPrRef; runs: readonly CiRun[] }) {
  const tone = prCiTone(pr, runs) ?? "neutral";
  const job = ciJobUrl(pr, runs, tone);
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[tone])} />
      <span>{t.ci[tone]}</span>
      {job && (
        <a href={job} target="_blank" rel="noreferrer noopener" className={cn("text-muted-foreground", LINK)}>
          {t.openJob}
        </a>
      )}
    </span>
  );
}

export function TrackingSection({ ticket, ciRuns, now }: Props) {
  const branch = branchRefOf(ticket.externalRefs);
  const pr = mainPr(ticket.externalRefs);
  const issues = issuesOf(ticket);
  const { session, delivery } = ticket;
  const empty = !branch && !pr && !session && !delivery && issues.externalRefs.length === 0;
  return (
    <section aria-labelledby={`tracking-${ticket.id}`} className="grid gap-2 px-4 text-xs">
      <h3 id={`tracking-${ticket.id}`} className="font-medium">
        {t.section}
      </h3>
      {empty ? (
        <p className="text-muted-foreground">{t.empty}</p>
      ) : (
        <dl className="grid grid-cols-[120px_1fr] items-center gap-y-2">
          {branch && (
            <Row label={t.branch}>
              <span className="font-mono">{branch.branch}</span>
              {branch.base && ` ${t.branchOn(branch.base)}`}
            </Row>
          )}
          {pr && (
            <Row label={t.prRow}>
              <PrLine pr={pr} />
            </Row>
          )}
          {pr && (
            <Row label={t.ciRow}>
              <CiLine pr={pr} runs={ciRuns} />
            </Row>
          )}
          {session && (
            <Row label={t.session}>{t.sessionLine(session.tool, durationLabel(now - session.startedAt))}</Row>
          )}
          {delivery && <Row label={t.step}>{stepLine(delivery)}</Row>}
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
