import type { CiRun, TicketView } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { ExternalLink, GitPullRequest } from "lucide-react";
import { Fragment } from "react";
import { frTicketTracking as t } from "../i18n/fr-ticket-tracking";
import { trackingAlert } from "./tracking-model";

const BOX = {
  amber: "bg-(--tracking-amber-soft)",
  red: "bg-(--tracking-red-soft)",
} as const;
const TEXT = { amber: "text-(--tracking-amber)", red: "text-(--tracking-red)" } as const;
const LINK = "inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline";

function External({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={LINK}>
      {label}
      <ExternalLink aria-hidden className="size-3 text-muted-foreground" />
    </a>
  );
}

export function TrackingBanner({ ticket, ciRuns }: { ticket: TicketView; ciRuns: readonly CiRun[] }) {
  const alert = trackingAlert(ticket, ciRuns);
  if (alert === null) return null;
  return (
    <output
      aria-label={t.banner}
      className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px]", BOX[alert.tone])}
    >
      <GitPullRequest aria-hidden className={cn("size-3.5 shrink-0", TEXT[alert.tone])} />
      <p className="min-w-0 flex-1">
        <span className="font-mono font-semibold text-foreground">{t.pr(alert.pr.number)}</span>
        {alert.parts.map((part) => (
          <Fragment key={part.text}>
            <span className="text-(--tracking-faint)">{" · "}</span>
            <span className={cn("font-medium", TEXT[part.tone])}>{part.text}</span>
          </Fragment>
        ))}
      </p>
      <span className="flex shrink-0 items-center gap-2 text-xs">
        <External href={alert.pr.url} label={t.prLink} />
        {alert.job && <External href={alert.job.url} label={t.jobLink(alert.job.name)} />}
      </span>
    </output>
  );
}
