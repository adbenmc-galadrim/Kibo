import { KiboError, type McpServerView } from "@kibo/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@kibo/sdk/ui/alert-dialog";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import type { IntegrationDialogProps } from "../../settings/integration-dialogs";
import { FormError } from "./FormError";
import { McpServerDialog } from "./McpServerDialog";
import { McpServerRow } from "./McpServerRow";

const t = fr.integrations.mcpServers;

const message = (e: unknown) => (e instanceof KiboError ? e.detail : String(e));

type RowError = { id: string | null; message: string };

export function McpServersDialog({ open, onDone }: IntegrationDialogProps) {
  const [servers, setServers] = useState<McpServerView[] | null>(null);
  const [error, setError] = useState<RowError | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<McpServerView | null>(null);

  const load = useCallback(async () => {
    try {
      setServers(await client.rpc({ method: "listMcpServers" }));
    } catch (e) {
      setError({ id: null, message: message(e) });
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const act = async (id: string, run: () => Promise<unknown>) => {
    setError(null);
    try {
      await run();
    } catch (e) {
      setError({ id, message: message(e) });
    }
    await load();
  };
  const toggle = (s: McpServerView, enabled: boolean) =>
    void act(s.id, () => client.rpc({ method: "setMcpServerEnabled", id: s.id, enabled }));
  const remove = (s: McpServerView) => {
    setRemoving(null);
    void act(s.id, () => client.rpc({ method: "removeMcpServer", id: s.id }));
  };

  if (adding) {
    return (
      <McpServerDialog
        open={open}
        onOpenChange={(o) => !o && setAdding(false)}
        takenIds={(servers ?? []).map((s) => s.id)}
        onAdded={() => {
          setAdding(false);
          void load();
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>
        {servers?.length === 0 && (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            {t.empty}
          </p>
        )}
        {servers && servers.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {servers.map((s) => (
              <McpServerRow
                key={s.id}
                server={s}
                error={error?.id === s.id ? error.message : null}
                onToggle={(enabled) => toggle(s, enabled)}
                onRemove={() => setRemoving(s)}
              />
            ))}
          </ul>
        )}
        <FormError message={error?.id === null ? error.message : null} />
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus aria-hidden className="size-4" />
            {t.add}
          </Button>
          <Button onClick={() => onDone()}>{fr.common.close}</Button>
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removing ? t.removeTitle(removing.name) : ""}</AlertDialogTitle>
            <AlertDialogDescription>{t.removeHelp}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{fr.common.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => removing && remove(removing)}>
              {t.remove}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
