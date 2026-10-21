import { cn } from "@kibo/sdk/lib/utils";
import { CircleCheck, CircleX, GitPullRequest } from "lucide-react";
import { fr } from "./fr";
import { CardHeader, FeatureChip, FLUSH_CARD, MONO_KEY, ROW_LINE } from "./parts";
import type { ReviewRow, ReviewState } from "./review-model";

function StateLine({ state }: { state: ReviewState }) {
  if (state === null) return null;
  const text = "text-[12px] leading-[15px]";
  if (state === "changes")
    return (
      <span className="flex items-center gap-[6px]">
        <CircleX absoluteStrokeWidth size={12} aria-hidden className="text-(--tracking-red)" />
        <span className={cn(text, "text-(--tracking-amber)")}>{fr.review.changes}</span>
      </span>
    );
  const icon =
    state === "ok" ? (
      <CircleCheck absoluteStrokeWidth size={12} aria-hidden className="text-(--tracking-green)" />
    ) : state === "error" ? (
      <CircleX absoluteStrokeWidth size={12} aria-hidden className="text-(--tracking-red)" />
    ) : (
      <span aria-hidden className="size-[11px] rounded-full border-(--tracking-amber) border-2" />
    );
  return (
    <span className="flex items-center gap-[6px]">
      {icon}
      <span className={cn(text, "text-(--tracking-mfg)")}>{fr.review.ci[state]}</span>
    </span>
  );
}

function PrRow({ row, onOpen }: { row: ReviewRow; onOpen(id: string): void }) {
  return (
    <li className={cn("flex gap-[12px] px-[16px] py-[10px]", ROW_LINE)}>
      <GitPullRequest
        absoluteStrokeWidth
        size={15}
        aria-hidden
        className={cn(
          "shrink-0",
          row.state === "changes" ? "text-(--tracking-amber)" : "text-(--tracking-purple)",
        )}
      />
      <div className="flex min-w-0 flex-col gap-[4px]">
        <button
          type="button"
          className="flex min-w-0 cursor-pointer items-center gap-[6px] text-left text-(--tracking-fg) text-[13px] leading-[16px] hover:underline"
          onClick={() => onOpen(row.ticketId)}
        >
          <span className="font-mono font-semibold">#{row.number}</span>
          <span className="truncate">{row.title}</span>
        </button>
        <span className="flex items-center gap-[6px]">
          <span className={MONO_KEY}>{row.key}</span>
          {row.feature !== null && <FeatureChip shortKey={row.feature} />}
        </span>
        <StateLine state={row.state} />
      </div>
    </li>
  );
}

export function InReviewCard({
  rows,
  onOpenTicket,
}: {
  rows: readonly ReviewRow[];
  onOpenTicket(id: string): void;
}) {
  return (
    <section aria-label={fr.review.title} className={FLUSH_CARD}>
      <CardHeader icon={GitPullRequest} title={fr.review.title} count={rows.length} />
      {rows.length === 0 ? (
        <p className={cn("px-[16px] py-[12px] text-(--tracking-mfg) text-[12.5px]", ROW_LINE)}>
          {fr.review.none}
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <PrRow key={`${row.ticketId}-${row.number}`} row={row} onOpen={onOpenTicket} />
          ))}
        </ul>
      )}
    </section>
  );
}
