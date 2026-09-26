import type { TicketView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Clock } from "lucide-react";
import { useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { useSyncState } from "../../state/use-sync-state";

const t = fr.integrations.sheet;

export function SyncStatus({ projectId, ticket }: { projectId: string; ticket: TicketView }) {
  const { state, error, reload } = useSyncState(projectId);
  const [actionError, setActionError] = useState<string | null>(null);
  const failure = state?.errors.find((e) => e.ticketId === ticket.id) ?? null;
  const pendingCreate = ticket.externalRefs.some((r) => r.kind === "github_issue" && r.number === null);
  const pending = state?.pending.includes(ticket.id) ?? false;
  const resolve = async (outboxId: number, action: "retry" | "drop") => {
    try {
      await client.rpc({ method: "resolveOutbox", projectId, outboxId, action });
      setActionError(null);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };
  if (failure) {
    return (
      <div
        role="alert"
        className="mx-4 grid gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs"
      >
        <p>
          <span className="font-medium">{t.syncError}</span> {failure.message}
        </p>
        {actionError && <p className="text-destructive">{actionError}</p>}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void resolve(failure.outboxId, "retry")}>
            {t.retry}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void resolve(failure.outboxId, "drop")}>
            {t.drop}
          </Button>
        </div>
      </div>
    );
  }
  if (error) return <p className="px-4 text-xs text-destructive">{error}</p>;
  if (!pending && !pendingCreate) return null;
  return (
    <p className="flex items-center gap-2 px-4 text-xs text-muted-foreground">
      <Clock aria-hidden className="size-3.5" />
      {pendingCreate ? t.pendingCreate : t.pending}
    </p>
  );
}
