import { lazyPanel } from "@kibo/sdk";
import { fr } from "../i18n/fr";
import { frOverlaps } from "../i18n/fr-overlaps";

const LazyOverlapFilesDialog = lazyPanel(
  () => import("./OverlapFilesDialog").then((m) => m.OverlapFilesDialog),
  fr.lazy,
  { fallback: "sr-only" },
);

type Props = { filesId: string | null; failed?: boolean; onClose(): void };

export function OverlapFeedLayer({ filesId, failed = false, onClose }: Props) {
  return (
    <>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {frOverlaps.moment.actionFailed}
        </p>
      )}
      {filesId && <LazyOverlapFilesDialog overlapId={filesId} onClose={onClose} />}
    </>
  );
}
