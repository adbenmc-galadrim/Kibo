import { externalRefKey, type TicketView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Clock } from "lucide-react";
import { useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { failureOf, syncErrorText } from "../../lib/sync-error-text";
import { useSyncState } from "../../state/use-sync-state";
import { DropSendDialog } from "./DropSendDialog";

const t = fr.integrations.sheet;

export function SyncStatus({ projectId, ticket }: { projectId: string; ticket: TicketView }) {
  const { state, error, reload } = useSyncState(projectId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const failure = state?.errors.find((e) => e.ticketId === ticket.id) ?? null;
  const pendingRefs = ticket.externalRefs.filter((r) => r.kind === "github_issue" && r.number === null);
  const pending = state?.pending.includes(ticket.id) ?? false;
  const failureRepo = ticket.externalRefs.find((r) => r.kind === "github_issue")?.repo ?? "";
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      setActionError(null);
    } catch (e) {
      setActionError(syncErrorText(failureOf(e), { repo: failureRepo, resumeAt: null }));
    }
    await reload();
  };
  const resolve = (outboxId: number, action: "retry" | "drop") =>
    client.rpc({ method: "resolveOutbox", projectId, outboxId, action });
  const drop = (outboxId: number, unlink: boolean) =>
    run(async () => {
      await resolve(outboxId, "drop");
      if (!unlink) return;
      for (const ref of pendingRefs) {
        await client.rpc({
          method: "command",
          projectId,
          command: {
            method: "removeExternalRef",
            ticketId: ticket.id,
            kind: ref.kind,
            key: externalRefKey(ref),
          },
        });
      }
    });
  if (failure) {
    return (
      <div
        role="alert"
        className="mx-4 grid gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs"
      >
        <p>
          <span className="font-medium">{t.syncError}</span>{" "}
          {syncErrorText(failure, { repo: failureRepo, resumeAt: null })}
        </p>
        {actionError && <p className="text-destructive">{actionError}</p>}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void run(() => resolve(failure.outboxId, "retry"))}
          >
            {t.retry}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmDrop(true)}>
            {t.drop}
          </Button>
        </div>
        <DropSendDialog
          open={confirmDrop}
          op={failure.op}
          canUnlink={pendingRefs.length > 0}
          onOpenChange={setConfirmDrop}
          onConfirm={(unlink) => void drop(failure.outboxId, unlink)}
        />
      </div>
    );
  }
  if (error) return <p className="px-4 text-xs text-destructive">{error}</p>;
  if (!pending && pendingRefs.length === 0) return null;
  return (
    <p className="flex items-center gap-2 px-4 text-xs text-muted-foreground">
      <Clock aria-hidden className="size-3.5" />
      {pendingRefs.length > 0 ? t.pendingCreate : t.pending}
    </p>
  );
}
