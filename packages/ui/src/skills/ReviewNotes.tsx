import type { Skill, SkillReview } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { ChevronRight, Copy, GitMerge, MessageSquareText, X } from "lucide-react";
import type { ReactNode } from "react";
import { Mention } from "../agents/mention/Mention";
import { frSkills } from "../i18n/fr-skills";
import { useOptionalHost } from "../shell/Host";
import { agoText } from "./skill-sections";

type Props = {
  skill: Skill;
  reviews: readonly SkillReview[];
  onIntegrate(review: SkillReview): void;
  onOpen(review: SkillReview): void;
  onIgnore(review: SkillReview): void;
  onCopy(review: SkillReview): void;
  onClose?(): void;
};

const t = frSkills.reviews;

export function VerdictBadge({ verdict }: { verdict: SkillReview["verdict"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 text-[10px] font-normal",
        verdict === "ok"
          ? "border-green-600/40 text-green-700 dark:text-green-400"
          : "border-brand/50 text-brand-strong dark:text-brand",
      )}
    >
      {verdict === "ok" ? t.ok : t.improve}
    </Badge>
  );
}

export function statusText(review: SkillReview): string {
  if (review.status === "integrated") return t.integrated;
  if (review.status === "ignored") return t.ignored;
  if (review.status === "replaced") return t.replaced;
  return t.pending;
}

function Origin({ review }: { review: SkillReview }) {
  const host = useOptionalHost();
  const ticketId = review.ticketId;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
      <Mention runId={review.runId} label={review.runLabel} />
      {review.ticketKey && ticketId && (
        <button
          type="button"
          aria-label={t.openTicket(review.ticketKey)}
          className="font-mono underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => host?.openTicket(ticketId)}
        >
          {review.ticketKey}
        </button>
      )}
      {review.suggestion !== null && <span>· {t.suggestion}</span>}
    </p>
  );
}

function ReviewCard({ review, now, children }: { review: SkillReview; now: number; children?: ReactNode }) {
  return (
    <article
      aria-label={review.runLabel}
      className="grid gap-2 rounded-lg border bg-card p-3 data-[verdict=improve]:border-brand/40"
      data-verdict={review.verdict}
    >
      <div className="flex items-center gap-2">
        <VerdictBadge verdict={review.verdict} />
        <span className="flex-1" />
        <span className="text-2xs text-muted-foreground">{t.ago(agoText(now - review.createdAt))}</span>
      </div>
      <p className="line-clamp-3 text-sm whitespace-pre-line">{review.note}</p>
      <Origin review={review} />
      {children}
    </article>
  );
}

export function ReviewNotes({ skill, reviews, onIntegrate, onOpen, onIgnore, onCopy, onClose }: Props) {
  const now = Date.now();
  const open = reviews.filter((r) => r.status === "new");
  const done = reviews.filter((r) => r.status !== "new");
  return (
    <aside aria-label={t.title} className="grid content-start gap-3">
      <div className="flex items-center gap-2">
        <MessageSquareText aria-hidden className="size-4 text-brand-strong" />
        <h3 className="text-sm font-semibold">{t.title}</h3>
        {open.length > 0 && (
          <Badge
            variant="outline"
            className="h-5 border-brand/50 text-[10px] text-brand-strong dark:text-brand"
          >
            {t.open(open.length)}
          </Badge>
        )}
        <span className="flex-1" />
        {onClose && (
          <Button variant="ghost" size="icon" className="size-7" aria-label={t.close} onClick={onClose}>
            <X />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t.help}</p>
      {reviews.length === 0 && <p className="text-xs text-muted-foreground">{t.empty}</p>}
      {open.map((review) => (
        <ReviewCard key={review.id} review={review} now={now}>
          <div className="flex flex-wrap gap-2">
            {skill.readOnly ? (
              <Button size="sm" variant="outline" onClick={() => onCopy(review)}>
                <Copy />
                {t.copyFirst}
              </Button>
            ) : review.suggestion !== null ? (
              <Button
                size="sm"
                variant="outline"
                className="border-brand/50 text-brand-strong dark:text-brand"
                onClick={() => onIntegrate(review)}
              >
                <GitMerge />
                {t.integrate}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => onOpen(review)}>
                {t.openHere}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onIgnore(review)}>
              {t.ignore}
            </Button>
          </div>
        </ReviewCard>
      ))}
      {done.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="group flex items-center gap-1.5 text-sm font-medium">
            <ChevronRight
              aria-hidden
              className="size-4 transition-transform group-data-[state=open]:rotate-90"
            />
            {t.done(done.length)}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 grid gap-2">
            {done.map((review) => (
              <ReviewCard key={review.id} review={review} now={now}>
                <p className="text-xs font-medium text-muted-foreground">{statusText(review)}</p>
              </ReviewCard>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </aside>
  );
}
