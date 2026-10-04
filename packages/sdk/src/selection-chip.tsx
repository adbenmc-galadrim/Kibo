import type { Selection } from "@kibo/schema";
import { X } from "lucide-react";
import { fr } from "./fr";
import { Button } from "./ui/button";

export function SelectionChip({ selection, onClear }: { selection: Selection | null; onClear(): void }) {
  if (!selection) return null;
  return (
    <output className="flex items-center gap-1 rounded-full border bg-muted/60 px-2 py-0.5 text-2xs">
      <span>{fr.selected(selection.ids.length)}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="size-5"
        aria-label={fr.clearSelection}
        onClick={onClear}
      >
        <X aria-hidden />
      </Button>
    </output>
  );
}
