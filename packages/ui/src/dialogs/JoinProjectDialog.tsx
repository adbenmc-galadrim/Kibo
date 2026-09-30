import { KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { CircleX, Loader2 } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frShare } from "../i18n/fr-share";
import { joinErrorText } from "../lib/share-errors";
import { navigate } from "../route";
import { FolderField } from "./FolderField";

const t = frShare;
type Failure = { text: string; badCode: boolean };

export function JoinProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const codeId = useId();
  const folderId = useId();
  const folderHelpId = useId();
  const [code, setCode] = useState("");
  const [folder, setFolder] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      const meta = await client.rpc({
        method: "joinProject",
        code: code.trim(),
        folder: folder.trim() || null,
      });
      onOpenChange(false);
      navigate(meta.id, null);
    } catch (err) {
      setFailure({
        text: joinErrorText(err),
        badCode: err instanceof KiboError && err.code === "INVITE_INVALID",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.joinTitle}</DialogTitle>
            <DialogDescription>{t.joinHelp}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={codeId}>{t.code}</Label>
            <Input
              id={codeId}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="font-mono"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={failure?.badCode === true}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={folderId}>{t.folder}</Label>
            <FolderField id={folderId} value={folder} onChange={setFolder} describedBy={folderHelpId} />
            <p id={folderHelpId} className="text-xs text-muted-foreground">
              {t.folderHelp}
            </p>
          </div>
          {failure && (
            <p
              role="alert"
              className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{failure.text}</span>
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {fr.common.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {busy ? t.joining : t.joinSubmit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
