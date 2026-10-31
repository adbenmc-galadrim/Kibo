import type { Question } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
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
import { Textarea } from "@kibo/sdk/ui/textarea";
import { type FormEvent, useId, useState } from "react";
import { fr } from "./fr";

type Props = { question: Question; onClose(): void };

export function EditQuestionDialog({ question: q, onClose }: Props) {
  const sdk = useSdk();
  const titleId = useId();
  const contextId = useId();
  const [title, setTitle] = useState(q.title);
  const [context, setContext] = useState(q.context);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const trimmed = title.trim();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      await sdk.run({
        method: "updateQuestion",
        questionId: q.id,
        title: trimmed,
        context,
        by: { kind: "human", ref: sdk.viewer },
      });
      onClose();
    } catch (err) {
      console.error(err);
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fr.edit.title}</DialogTitle>
          <DialogDescription>{fr.edit.description}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={submit}>
          <div className="grid gap-1.5">
            <Label htmlFor={titleId}>{fr.dialog.questionTitle}</Label>
            <Input id={titleId} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={contextId}>{fr.dialog.context}</Label>
            <Textarea id={contextId} rows={4} value={context} onChange={(e) => setContext(e.target.value)} />
          </div>
          {failed && (
            <p role="alert" className="text-xs text-destructive">
              {fr.edit.failed}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {fr.cancel}
            </Button>
            <Button type="submit" disabled={busy || trimmed === ""}>
              {fr.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
