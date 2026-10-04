import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Maximize, Minus, Plus } from "lucide-react";
import { fr } from "./fr";

export function Legend({ compact }: { compact: boolean }) {
  return (
    <div
      className={cn(
        "absolute bottom-3 left-3 rounded-md border bg-card p-2 text-2xs text-muted-foreground",
        compact ? "flex items-center gap-3 py-1" : "grid gap-1",
      )}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="h-px w-5 bg-muted-foreground" />
        {fr.legend.blocks}
      </span>
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="h-0.5 w-5 bg-foreground" />
        {fr.legend.critical}
      </span>
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="w-5 border-t border-dashed border-muted-foreground" />
        {fr.legend.relates}
      </span>
    </div>
  );
}

type ZoomProps = { zoom: number; onZoom(z: number): void; onFit(): void };

export function ZoomControls({ zoom, onZoom, onFit }: ZoomProps) {
  return (
    <div className="absolute right-3 bottom-3 flex items-center rounded-md border bg-card">
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label={fr.fitAll}
        title={fr.fitAll}
        onClick={onFit}
      >
        <Maximize aria-hidden="true" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label={fr.zoomIn}
        onClick={() => onZoom(zoom + 0.1)}
      >
        <Plus aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        className="h-7 px-2 font-mono text-2xs"
        aria-label={fr.zoomReset}
        onClick={() => onZoom(1)}
      >
        {`${Math.round(zoom * 100)} %`}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label={fr.zoomOut}
        onClick={() => onZoom(zoom - 0.1)}
      >
        <Minus aria-hidden="true" />
      </Button>
    </div>
  );
}
