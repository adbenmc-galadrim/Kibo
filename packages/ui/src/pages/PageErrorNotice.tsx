import { Button } from "@kibo/sdk/ui/button";
import { TriangleAlert } from "lucide-react";
import { frShell } from "../i18n/fr-shell";

const t = frShell.pageError;

export function PageErrorNotice({ onRetry }: { onRetry(): void }) {
  return (
    <div className="p-6">
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3"
      >
        <TriangleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="text-sm font-medium">{t.title}</p>
          <p className="text-xs text-muted-foreground">{t.detail}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t.retry}
        </Button>
      </div>
    </div>
  );
}
