import { Button } from "@kibo/sdk/ui/button";
import { CircleCheck } from "lucide-react";
import { useEffect } from "react";
import { fr } from "./fr";

const VISIBLE_MS = 8_000;

type Props = { count: number; undoFailed: boolean; onUndo(): void; onClose(): void };

export function ExportToast({ count, undoFailed, onUndo, onClose }: Props) {
  useEffect(() => {
    if (undoFailed) return;
    const timer = setTimeout(onClose, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [undoFailed, onClose]);
  return (
    <output
      aria-label={fr.exporting.marked(count)}
      className="fixed right-10 bottom-7 z-50 flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-3 text-card-foreground shadow-md"
    >
      <CircleCheck aria-hidden className="size-4 text-emerald-500" />
      <span className="grid text-sm font-medium">
        {fr.exporting.marked(count)}
        {undoFailed && (
          <span role="alert" className="text-xs font-normal text-destructive">
            {fr.exporting.undoFailed}
          </span>
        )}
      </span>
      <Button type="button" variant="outline" size="sm" className="h-6.5 px-2.5 text-xs" onClick={onUndo}>
        {fr.exporting.undo}
      </Button>
    </output>
  );
}
