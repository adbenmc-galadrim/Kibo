import { Progress } from "@kibo/sdk/ui/progress";
import { useEffect } from "react";
import { frFiles as t } from "../i18n/fr-files";
import type { Sending } from "./use-project-files";
import { useSmoothRatio } from "./use-smooth-ratio";

const statusOf = (s: Sending, percent: number) => {
  if (s.done) return t.uploaded;
  if (s.ratio >= 1) return t.finishing;
  return t.uploadPercent(percent);
};

function SendingRow({ sending, onShown }: { sending: Sending; onShown(key: number): void }) {
  const shown = useSmoothRatio(sending.ratio);
  const percent = Math.round(shown * 100);
  const full = shown >= 1;
  useEffect(() => {
    if (full) onShown(sending.key);
  }, [full, onShown, sending.key]);
  return (
    <li className="grid gap-1">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="min-w-0 truncate font-mono text-muted-foreground">{sending.name}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{statusOf(sending, percent)}</span>
      </div>
      <Progress
        aria-label={t.uploading(sending.name)}
        value={percent}
        className="[&_[data-slot=progress-indicator]]:transition-none"
      />
    </li>
  );
}

export function SendingList({ sending, onShown }: { sending: Sending[]; onShown(key: number): void }) {
  if (sending.length === 0) return null;
  return (
    <ul aria-label={t.uploads} className="grid gap-2">
      {sending.map((s) => (
        <SendingRow key={s.key} sending={s} onShown={onShown} />
      ))}
    </ul>
  );
}
