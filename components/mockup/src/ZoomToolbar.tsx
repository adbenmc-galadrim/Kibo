import { Button } from "@kibo/sdk/ui/button";
import { Minus, Plus } from "lucide-react";
import { fr } from "./fr";
import { FITTED, percent, ZOOM_STEP, type ZoomAction, type ZoomState } from "./zoom";

type Props = { zoom: ZoomState; onAction(action: ZoomAction): void };

const isFitted = (z: ZoomState) => z.scale === FITTED.scale && z.pan.x === 0 && z.pan.y === 0;

export function ZoomToolbar({ zoom, onAction }: Props) {
  return (
    <div
      role="toolbar"
      aria-label={fr.zoom.toolbar}
      className="absolute right-2 bottom-2 flex items-center gap-0.5 rounded-md border bg-card/90 p-0.5 shadow-xs backdrop-blur"
    >
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={fr.zoom.out}
        title={fr.zoom.out}
        onClick={() => onAction({ kind: "zoom", factor: 1 / ZOOM_STEP })}
      >
        <Minus />
      </Button>
      <span className="min-w-11 text-center font-mono text-2xs tabular-nums" aria-live="polite">
        {percent(zoom.scale)}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={fr.zoom.in}
        title={fr.zoom.in}
        onClick={() => onAction({ kind: "zoom", factor: ZOOM_STEP })}
      >
        <Plus />
      </Button>
      <Button variant="ghost" size="xs" disabled={isFitted(zoom)} onClick={() => onAction({ kind: "fit" })}>
        {fr.zoom.fit}
      </Button>
    </div>
  );
}
