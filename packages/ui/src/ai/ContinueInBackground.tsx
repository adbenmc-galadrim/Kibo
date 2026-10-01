import type { DraftStatus } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { DialogFooter } from "@kibo/sdk/ui/dialog";
import { frCreations } from "../i18n/fr-creations";

const FINISHED: ReadonlySet<DraftStatus> = new Set(["done", "abandoned"]);

export function ContinueInBackground({
  status,
  onContinue,
}: {
  status: DraftStatus | null;
  onContinue(): void;
}) {
  if (!status || FINISHED.has(status)) return null;
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onContinue}>
        {frCreations.background.action}
      </Button>
    </DialogFooter>
  );
}
