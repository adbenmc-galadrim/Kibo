import { CircleCheck, ClockAlert, Lock, TriangleAlert } from "lucide-react";
import { fr } from "./fr";
import type { CardBadge } from "./planning-model";

const CHIP =
  "ml-auto flex h-[17px] items-center gap-1 rounded-[4px] px-1.5 text-[10.5px] leading-[13px] font-medium";

function deliveredText(badge: { demo: boolean; held: number }): string {
  if (badge.held > 0) return fr.badge.deliveredHeld(badge.held);
  return badge.demo ? fr.badge.deliveredDemo : fr.badge.delivered;
}

export function FeatureBadge({ badge }: { badge: CardBadge | null }) {
  if (badge === null) return null;
  if (badge.kind === "delivered")
    return (
      <span className="ml-auto flex items-center gap-1.5 whitespace-nowrap text-(--tracking-green) text-[11.5px] leading-[14px]">
        <CircleCheck absoluteStrokeWidth size={13} aria-hidden />
        {deliveredText(badge)}
      </span>
    );
  if (badge.kind === "open")
    return (
      <span className={`${CHIP} bg-(--tracking-blue-soft) text-(--tracking-blue)`}>{fr.badge.open}</span>
    );
  if (badge.kind === "risk")
    return (
      <span className={`${CHIP} bg-(--tracking-amber-soft) text-(--tracking-amber)`}>
        <TriangleAlert absoluteStrokeWidth size={12} aria-hidden />
        {fr.badge.risk}
      </span>
    );
  if (badge.kind === "late")
    return (
      <span className={`${CHIP} bg-(--tracking-red-soft) text-(--tracking-red)`}>
        <ClockAlert absoluteStrokeWidth size={12} aria-hidden />
        {fr.badge.late}
      </span>
    );
  return (
    <span className={`${CHIP} bg-(--tracking-red-soft) text-(--tracking-red)`}>
      <Lock absoluteStrokeWidth size={12} aria-hidden />
      {badge.question === null ? fr.badge.blocked : fr.badge.blockedBy(badge.question)}
    </span>
  );
}
