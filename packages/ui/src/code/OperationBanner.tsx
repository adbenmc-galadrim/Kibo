import type { GitOperation } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { fr } from "../i18n/fr";

type Props = { operation: GitOperation; busy: boolean; onAbort(): void };

export function OperationBanner({ operation, busy, onAbort }: Props) {
  return (
    <div className="flex items-center gap-3 border-b bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
      <span className="flex-1">{fr.changes.operation(fr.changes.operations[operation])}</span>
      <Button variant="outline" size="sm" disabled={busy} onClick={onAbort}>
        {fr.changes.abortOperation}
      </Button>
    </div>
  );
}

type AlertsProps = {
  operation: GitOperation | null;
  busy: boolean;
  onAbort(): void;
  error: string | null;
  notice: string | null;
};

export function ChangesAlerts({ operation, busy, onAbort, error, notice }: AlertsProps) {
  return (
    <>
      {operation && <OperationBanner operation={operation} busy={busy} onAbort={onAbort} />}
      {error && (
        <p role="alert" className="border-b px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && <output className="block border-b px-4 py-2 text-sm">{notice}</output>}
    </>
  );
}
