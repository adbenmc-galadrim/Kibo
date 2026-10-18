import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
import { fr } from "./fr";

export function EmptyPage({ onNew }: { onNew?: () => void }) {
  return (
    <div data-slot="questions-empty" className="grid justify-items-center gap-3 py-16 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">{fr.emptyPage}</p>
      {onNew && (
        <Button type="button" variant="outline" size="sm" onClick={onNew}>
          <Plus aria-hidden className="size-3.5" />
          {fr.newQuestion}
        </Button>
      )}
    </div>
  );
}
