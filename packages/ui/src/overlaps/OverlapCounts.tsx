import { Copy } from "lucide-react";
import { frOverlaps } from "../i18n/fr-overlaps";
import { activityCounts, overlapCounts } from "./overlap-labels";
import { useRunsOverlaps } from "./use-overlaps";

export function OverlapCounts({ runIds }: { runIds: readonly string[] }) {
  const { overlaps, error } = useRunsOverlaps(runIds);
  if (error)
    return (
      <p role="alert" className="text-xs text-destructive">
        {frOverlaps.activity.failed}
      </p>
    );
  if (overlaps.length === 0) return null;
  const { resolved, open } = overlapCounts(overlaps);
  return (
    <p className="flex items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
      <Copy aria-hidden className="size-3.5" />
      {activityCounts(resolved, open)}
    </p>
  );
}
