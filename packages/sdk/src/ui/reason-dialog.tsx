import { useId, useState } from "react";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";

export type ReasonDialogProps = {
  open: boolean;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  cancelLabel: string;
  error: string | null;
  onConfirm(reason: string): void;
  onCancel(): void;
};

export function ReasonDialog(p: ReasonDialogProps) {
  const id = useId();
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  return (
    <Dialog open={p.open} onOpenChange={(o) => !o && p.onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{p.title}</DialogTitle>
          <DialogDescription>{p.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={id}>{p.label}</Label>
          <Textarea id={id} value={reason} placeholder={p.placeholder} onChange={(e) => setReason(e.target.value)} />
          {p.error && (
            <p role="alert" className="text-sm text-destructive">
              {p.error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={p.onCancel}>
            {p.cancelLabel}
          </Button>
          <Button disabled={trimmed.length === 0} onClick={() => p.onConfirm(trimmed)}>
            {p.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
