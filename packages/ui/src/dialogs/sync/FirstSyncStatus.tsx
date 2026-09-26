import { RefreshCw } from "lucide-react";
import { fr } from "../../i18n/fr";
import type { FirstSync } from "./use-first-sync";

const t = fr.integrations.source;

export function FirstSyncStatus({ sync }: { sync: FirstSync }) {
  if (sync.binding === null || sync.error !== null) return null;
  const imported = sync.progress?.imported ?? 0;
  const running = sync.progress?.running ?? true;
  return (
    <output className="flex items-center gap-2 text-sm text-muted-foreground">
      {running && <RefreshCw aria-hidden className="size-3.5 shrink-0 animate-spin" />}
      {running ? t.progress(imported) : t.done(imported)}
    </output>
  );
}
