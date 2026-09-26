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
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Label } from "@kibo/sdk/ui/label";
import { useId, useState } from "react";
import { fr } from "../../i18n/fr";

const t = fr.integrations.sheet;

type Props = {
  open: boolean;
  canUnlink: boolean;
  onOpenChange(open: boolean): void;
  onConfirm(unlink: boolean): void;
};

export function DropSendDialog({ open, canUnlink, onOpenChange, onConfirm }: Props) {
  const [unlink, setUnlink] = useState(true);
  const unlinkId = useId();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.dropTitle}</AlertDialogTitle>
          <AlertDialogDescription>{t.dropHelp}</AlertDialogDescription>
        </AlertDialogHeader>
        {canUnlink && (
          <div className="flex items-center gap-2">
            <Checkbox id={unlinkId} checked={unlink} onCheckedChange={(v) => setUnlink(v === true)} />
            <Label htmlFor={unlinkId}>{t.dropUnlink}</Label>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{fr.common.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => onConfirm(canUnlink && unlink)}>
            {t.drop}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
