import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
import { fr } from "./fr";

export function KanbanEmpty({ onNew }: { onNew?: () => void }) {
  return (
    <div data-slot="kanban-empty" className="flex items-center justify-center gap-3 px-3 pt-3 text-center">
      <p className="text-sm text-muted-foreground">{fr.empty.text}</p>
      {onNew && (
        <Button type="button" variant="outline" size="sm" onClick={onNew}>
          <Plus aria-hidden className="size-3.5" />
          {fr.empty.action}
        </Button>
      )}
    </div>
  );
}
