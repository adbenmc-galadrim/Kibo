import { type DraftAttachmentInput, MAX_DRAFT_FEEDBACK, MIN_DRAFT_FEEDBACK } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Bot } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { frCreations } from "../i18n/fr-creations";
import { AttachmentsField } from "./AttachmentsField";

const t = frCreations.revise;

export type ReviseInput = { feedback: string; attachments: DraftAttachmentInput[] };

export type ReviseFormProps = {
  busy: boolean;
  remaining: number;
  onSubmit(input: ReviseInput): void;
  onCancel(): void;
};

export function ReviseForm({ busy, remaining, onSubmit, onCancel }: ReviseFormProps) {
  const id = useId();
  const feedbackRef = useRef<HTMLTextAreaElement>(null);
  const [feedback, setFeedback] = useState("");
  const [attachments, setAttachments] = useState<DraftAttachmentInput[]>([]);
  const length = feedback.trim().length;
  useEffect(() => {
    feedbackRef.current?.focus();
  }, []);
  const valid = length >= MIN_DRAFT_FEEDBACK && length <= MAX_DRAFT_FEEDBACK;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    onSubmit({ feedback: feedback.trim(), attachments });
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    onCancel();
  };

  return (
    <form
      data-revise-form=""
      aria-label={t.title}
      onSubmit={submit}
      onKeyDown={onKeyDown}
      className="grid gap-3 rounded-lg border p-4"
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-feedback`}>{t.label}</Label>
        <Textarea
          id={`${id}-feedback`}
          ref={feedbackRef}
          rows={3}
          maxLength={MAX_DRAFT_FEEDBACK}
          placeholder={t.placeholder}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <p className="flex justify-between gap-2 text-[11px] text-muted-foreground">
          <span>{t.remaining(remaining)}</span>
          <span className="font-mono">{t.count(length)}</span>
        </p>
      </div>
      <AttachmentsField
        value={attachments}
        onChange={setAttachments}
        disabled={busy}
        pasteFrom={feedbackRef}
      />
      {length > 0 && length < MIN_DRAFT_FEEDBACK && (
        <p className="text-xs text-muted-foreground">{t.tooShort}</p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.cancel}
        </Button>
        <Button type="submit" variant="agent" disabled={!valid || busy}>
          <Bot aria-hidden className="size-4" />
          {t.submit}
        </Button>
      </div>
    </form>
  );
}
