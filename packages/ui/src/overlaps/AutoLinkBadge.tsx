import type { AutoLink } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@kibo/sdk/ui/popover";
import { Link2, Undo2 } from "lucide-react";
import { useState } from "react";
import { frOverlaps } from "../i18n/fr-overlaps";

type Props = {
  link: AutoLink;
  otherKey: string;
  canEdit: boolean;
  onCancel(id: string): Promise<void> | void;
};

const t = frOverlaps.badge;

export function AutoLinkBadge({ link, otherKey, canEdit, onCancel }: Props) {
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await onCancel(link.id);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={t.label(otherKey)} className="shrink-0 rounded-full">
          <Badge variant="outline" className="gap-1 text-3xs font-normal text-muted-foreground">
            <Link2 aria-hidden className="size-3" />
            {t.byKibo}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="grid w-auto max-w-80 gap-1 p-2.5 text-xs">
        <p>
          {t.reason[link.reason]} <span className="font-mono">{link.detail.path}</span>
        </p>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>{t.at(link.at)}</span>
          {canEdit && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto h-6 gap-1 px-1.5 text-xs"
              disabled={busy}
              onClick={() => void cancel()}
            >
              <Undo2 aria-hidden className="size-3" />
              {t.cancel}
            </Button>
          )}
        </div>
        {failed && (
          <p role="alert" className="text-destructive">
            {t.failed}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
