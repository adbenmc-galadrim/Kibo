import type { Question } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { ClipboardPaste } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { fr } from "./fr";
import { AGENT_ACCENT } from "./QuestionAnswerForm";
import { answerFrom } from "./questions-logic";
import { useAnswer } from "./use-questions";

export function PasteAnswerForm({ question }: { question: Question }) {
  const answer = useAnswer();
  const fieldId = useId();
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (text === null)
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`h-7 text-xs ${AGENT_ACCENT}`}
        onClick={() => setText("")}
      >
        <ClipboardPaste aria-hidden />
        {fr.paste.open}
      </Button>
    );
  const input = answerFrom({ option: null, text, confirm: false });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (input === null) return;
    setBusy(true);
    setFailed(false);
    try {
      await answer(question, input);
    } catch (err) {
      console.error(err);
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <form aria-label={fr.paste.form(question.title)} className="grid w-full gap-2" onSubmit={submit}>
      <label htmlFor={fieldId} className="text-xs font-medium">
        {fr.paste.label}
      </label>
      <Textarea
        id={fieldId}
        rows={4}
        className="text-sm"
        value={text}
        disabled={busy}
        autoFocus
        onChange={(e) => setText(e.target.value)}
      />
      <p className="text-2xs text-muted-foreground">{fr.paste.help}</p>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setText(null)}
        >
          {fr.cancel}
        </Button>
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={busy || input === null}>
          {fr.paste.save}
        </Button>
      </div>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {fr.answerFailed}
        </p>
      )}
    </form>
  );
}
