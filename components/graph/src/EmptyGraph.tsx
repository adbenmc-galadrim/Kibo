import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
import { fr } from "./fr";

export function EmptyGraph({ onNewFeature, className }: { onNewFeature(): void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 p-6", className)}>
      <p className="text-(--tracking-mfg) text-sm">{fr.sprints.empty}</p>
      <Button variant="outline" size="sm" onClick={onNewFeature}>
        <Plus absoluteStrokeWidth size={14} aria-hidden />
        {fr.sprints.newFeature}
      </Button>
    </div>
  );
}
