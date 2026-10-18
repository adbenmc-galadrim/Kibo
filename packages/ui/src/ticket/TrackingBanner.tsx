import type { CiRun, TicketView } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { CircleAlert, ExternalLink, LoaderCircle } from "lucide-react";
import { frTicketTracking as t } from "../i18n/fr-ticket-tracking";
import { trackingAlert } from "./tracking-model";

const TONE = {
  error: "border-(--tracking-red)/40 bg-(--tracking-red-soft) text-(--tracking-red)",
  running: "border-(--tracking-amber)/40 bg-(--tracking-amber-soft) text-(--tracking-amber)",
} as const;

const LINK = "inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline";

export function TrackingBanner({ ticket, ciRuns }: { ticket: TicketView; ciRuns: readonly CiRun[] }) {
  const alert = trackingAlert(ticket, ciRuns);
  if (alert === null) return null;
  const Icon = alert.tone === "error" ? CircleAlert : LoaderCircle;
  const [first, ...rest] = alert.parts;
  return (
    <output
      aria-label={t.banner}
      className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-xs", TONE[alert.tone])}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <p className="min-w-0 flex-1">
        <a href={alert.pr.url} target="_blank" rel="noreferrer noopener" className={LINK}>
          {first}
        </a>
        {rest.map((part) => ` · ${part}`).join("")}
      </p>
      {alert.jobUrl && (
        <a href={alert.jobUrl} target="_blank" rel="noreferrer noopener" className={cn(LINK, "shrink-0")}>
          {t.openJob}
          <ExternalLink aria-hidden className="size-3" />
        </a>
      )}
    </output>
  );
}
