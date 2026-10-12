import { AlarmClock } from "lucide-react";
import { formatClock } from "../../agents/format";
import { frSignals } from "../../i18n/fr-signals";
import type { WakeupState } from "./signal-sections";

const t = frSignals.wakeup;

function wakeupText(wakeup: WakeupState): string {
  if (wakeup === "none") return t.none;
  return wakeup.kind === "due" ? t.due(formatClock(wakeup.at)) : t.last(formatClock(wakeup.at));
}

export function WakeupLine({ wakeup }: { wakeup: WakeupState }) {
  return (
    <section aria-label={t.label} className="grid gap-1">
      <h3 className="text-xs font-medium text-muted-foreground uppercase">{t.label}</h3>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlarmClock className="size-3.5 shrink-0" aria-hidden />
        {wakeupText(wakeup)}
      </p>
    </section>
  );
}
