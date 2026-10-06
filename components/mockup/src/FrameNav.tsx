import { Button } from "@kibo/sdk/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fr } from "./fr";

type Props = { index: number; count: number; onChange(index: number): void };

export function FrameNav({ index, count, onChange }: Props) {
  return (
    <fieldset
      aria-label={fr.nav.group}
      className="m-0 flex shrink-0 items-center justify-center gap-1 border-0 px-3 py-1"
    >
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={fr.nav.prev}
        title={fr.nav.prev}
        disabled={index === 0}
        onClick={() => onChange(index - 1)}
      >
        <ChevronLeft />
      </Button>
      <span
        className="min-w-10 text-center font-mono text-2xs tabular-nums text-muted-foreground"
        aria-live="polite"
      >
        {fr.nav.position(index + 1, count)}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={fr.nav.next}
        title={fr.nav.next}
        disabled={index >= count - 1}
        onClick={() => onChange(index + 1)}
      >
        <ChevronRight />
      </Button>
    </fieldset>
  );
}
