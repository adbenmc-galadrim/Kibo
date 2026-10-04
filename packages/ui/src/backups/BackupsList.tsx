import type { BackupInfo } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { frBackups as t } from "../i18n/fr-backups";
import { errorMessage } from "../lib/error-message";
import { backupDateLabel, sizeLabel } from "./backups-text";

function BackupRow({ backup, onRemove }: { backup: BackupInfo; onRemove(): void }) {
  return (
    <li className="flex items-center gap-3 py-1.5 text-sm">
      <span className="tabular-nums">{backupDateLabel(backup.createdAt)}</span>
      <span className="text-muted-foreground">{t.reasons[backup.reason]}</span>
      <span className="text-muted-foreground tabular-nums">{sizeLabel(backup.bytes)}</span>
      <span className="flex-1" />
      <Button variant="ghost" size="sm" onClick={onRemove}>
        {t.remove}
      </Button>
    </li>
  );
}

export function BackupsList({
  backups,
  onDelete,
}: {
  backups: BackupInfo[];
  onDelete(id: string): Promise<void>;
}) {
  const [target, setTarget] = useState<BackupInfo | null>(null);
  if (backups.length === 0) return null;
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="group -ml-2 w-fit">
          <ChevronRight aria-hidden className="transition-transform group-data-[state=open]:rotate-90" />
          {t.list(backups.length)}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y rounded-md border px-3">
          {backups.map((backup) => (
            <BackupRow key={backup.id} backup={backup} onRemove={() => setTarget(backup)} />
          ))}
        </ul>
      </CollapsibleContent>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title={t.removeTitle}
        description={target ? t.removeHelp(backupDateLabel(target.createdAt)) : ""}
        confirmLabel={t.remove}
        cancelLabel={t.cancel}
        onConfirm={() => (target ? onDelete(target.id) : Promise.resolve())}
        describeError={errorMessage}
      />
    </Collapsible>
  );
}
