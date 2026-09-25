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
import { Textarea } from "@kibo/sdk/ui/textarea";
import { useId, useState } from "react";
import { fr } from "./fr";

type Props = {
  ticketKey: string;
  error: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

export function BlockDialog({ ticketKey, error, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState("");
  const reasonId = useId();
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fr.block.title(ticketKey)}</DialogTitle>
          <DialogDescription>{fr.block.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={reasonId}>{fr.block.reason}</Label>
          <Textarea
            id={reasonId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={fr.block.placeholder}
            autoFocus
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {fr.block.cancel}
          </Button>
          <Button disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>
            {fr.block.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
