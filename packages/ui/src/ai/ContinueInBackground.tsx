import { Button } from "@kibo/sdk/ui/button";
import { DialogFooter } from "@kibo/sdk/ui/dialog";
import { frCreations } from "../i18n/fr-creations";
import { useComponentDraft } from "./use-component-draft";

const FINISHED = new Set(["done", "abandoned"]);

export function ContinueInBackground({ draftId, onContinue }: { draftId: string; onContinue(): void }) {
  const { details } = useComponentDraft(draftId);
  if (!details || FINISHED.has(details.status)) return null;
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onContinue}>
        {frCreations.background.action}
      </Button>
    </DialogFooter>
  );
}
