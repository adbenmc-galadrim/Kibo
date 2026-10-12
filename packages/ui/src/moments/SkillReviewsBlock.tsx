import type { RunMoment, SkillId, SkillReview } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { BookOpen } from "lucide-react";
import { frMoments } from "../i18n/fr-moments";
import { frSkills } from "../i18n/fr-skills";
import { useOptionalHost } from "../shell/Host";
import { statusText, VerdictBadge } from "../skills/ReviewNotes";
import { useSkillReviews } from "../skills/use-skill-reviews";

type Props = { runId: string; reviews: SkillReview[]; usedSkills: number; onOpenSkill(id: SkillId): void };

const t = frSkills.reviews;

export function usedSkills(moments: readonly RunMoment[]): number {
  const ids = moments.flatMap((m) =>
    m.data.kind === "actions"
      ? m.data.actions.filter((a) => a.kind === "skill" && a.outcome !== "denied").map((a) => a.target ?? "")
      : [],
  );
  return new Set(ids).size;
}

function ReviewLine({ review, onOpenSkill }: { review: SkillReview; onOpenSkill(id: SkillId): void }) {
  const pending = review.status === "new";
  return (
    <li aria-label={review.skillId} className="grid gap-1 py-2 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="font-mono text-sm font-medium underline-offset-2 hover:underline"
          onClick={() => onOpenSkill(review.skillId)}
        >
          {review.skillId}
        </button>
        <VerdictBadge verdict={review.verdict} />
        <span className="flex-1" />
        <span className={cn("text-xs", pending ? "font-medium text-brand-strong" : "text-muted-foreground")}>
          {statusText(review)}
        </span>
      </div>
      <p className="line-clamp-3 text-xs whitespace-pre-line text-muted-foreground">{review.note}</p>
    </li>
  );
}

export function SkillReviewsBlock({ runId, reviews, usedSkills: used, onOpenSkill }: Props) {
  if (used === 0 && reviews.length === 0) return null;
  return (
    <section aria-label={frMoments.run.reviews} data-run={runId} className="grid gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <BookOpen aria-hidden className="size-4" />
        {frMoments.run.reviews}
        <span className="flex-1" />
        <span className="text-xs font-normal text-muted-foreground">
          {t.blockMeta(Math.max(used, reviews.length))}
        </span>
      </h3>
      {reviews.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.none}</p>
      ) : (
        <ul className="grid divide-y">
          {reviews.map((review) => (
            <ReviewLine key={review.id} review={review} onOpenSkill={onOpenSkill} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function RunSkillReviews({ runId, moments }: { runId: string; moments: readonly RunMoment[] }) {
  const host = useOptionalHost();
  const { reviews } = useSkillReviews({ runId });
  return (
    <SkillReviewsBlock
      runId={runId}
      reviews={reviews ?? []}
      usedSkills={usedSkills(moments)}
      onOpenSkill={(skillId) => host?.openTarget({ kind: "skill", skillId })}
    />
  );
}
