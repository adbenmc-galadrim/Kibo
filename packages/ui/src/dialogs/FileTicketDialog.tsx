import {
  isInbox,
  KiboError,
  type KiboErrorCode,
  type ProjectSnapshot,
  type ProjectSummary,
  type TicketView,
} from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Label } from "@kibo/sdk/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { useId, useState } from "react";
import { client } from "../api";
import { frInbox } from "../i18n/fr-inbox";
import { canEdit } from "../state/access";

export type FileTicketDialogProps = {
  ticket: TicketView;
  hasChildren: boolean;
  hasLinks: boolean;
  projects: ProjectSummary[];
  snapshots: ReadonlyMap<string, ProjectSnapshot>;
  onClose(): void;
  onFiled(projectId: string, ticketId: string): void;
};

const t = frInbox.dialog;
const ERRORS: Partial<Record<KiboErrorCode, string>> = t.errors;

const describeFileError = (e: unknown): string =>
  e instanceof KiboError ? (ERRORS[e.code] ?? t.failed) : t.failed;

function keyText(snapshot: ProjectSnapshot | undefined): string {
  if (!snapshot) return "";
  const next = snapshot.nextTicketKey;
  return snapshot.sync.keyAllocator === "server" || next === null ? t.serverKey : t.nextKey(next);
}

export function FileTicketDialog({
  ticket,
  hasChildren,
  hasLinks,
  projects,
  snapshots,
  ...p
}: FileTicketDialogProps) {
  const id = useId();
  const targets = projects.filter((x) => {
    const snapshot = snapshots.get(x.id);
    return !isInbox(x.id) && snapshot !== undefined && canEdit(snapshot);
  });
  const [projectId, setProjectId] = useState(targets[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = targets.find((x) => x.id === projectId) ?? null;

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const filed = await client.rpc({ method: "fileTicket", ticketId: ticket.id, projectId: target.id });
      p.onFiled(target.id, filed.ticketId);
    } catch (e) {
      setError(describeFileError(e));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && p.onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t.title(ticket.keyLabel)}</DialogTitle>
          <DialogDescription className="truncate">{ticket.title}</DialogDescription>
        </DialogHeader>
        {target ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-project`}>{t.project}</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id={`${id}-project`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      {x.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1 text-sm text-muted-foreground">
              <p>{keyText(snapshots.get(target.id))}</p>
              {hasChildren && <p>{t.children}</p>}
              {hasLinks && <p>{t.links}</p>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t.noProject}</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={p.onClose}>
            {t.cancel}
          </Button>
          <Button disabled={!target || busy} onClick={confirm}>
            {t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
