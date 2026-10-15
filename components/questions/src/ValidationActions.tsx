import { correctionAnswer, type Question, VALIDATION_OPTIONS } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Check, Pencil, Send } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { fr } from "./fr";
import { useAnswer } from "./use-questions";

const [VALIDATE] = VALIDATION_OPTIONS;

export const isScreenValidation = (q: Question): boolean => q.kind === "validation" && q.images.length > 0;

export function ValidationActions({ question }: { question: Question }) {
  const answer = useAnswer();
  const fieldId = useId();
  const [correcting, setCorrecting] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const send = async (input: Parameters<typeof answer>[1]) => {
    setBusy(true);
    setFailed(false);
    try {
      await answer(question, input);
    } catch (e) {
      console.error(e);
      setFailed(true);
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim() !== "") void send({ kind: "text", text: correctionAnswer(text) });
  };
  const error = failed && (
    <p role="alert" className="text-xs text-destructive">
      {fr.answerFailed}
    </p>
  );
  if (correcting) {
    return (
      <form
        aria-label={fr.validation.correctionForm(question.title)}
        className="grid gap-1.5"
        onSubmit={submit}
      >
        <label htmlFor={fieldId} className="text-xs font-medium">
          {fr.validation.correction}
        </label>
        <Textarea
          id={fieldId}
          autoFocus
          required
          className="min-h-16 text-xs"
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="text-2xs text-muted-foreground">{fr.validation.correctionHelp}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setCorrecting(false)}
          >
            {fr.cancel}
          </Button>
          <Button type="submit" size="sm" className="h-7 text-xs" disabled={busy || text.trim() === ""}>
            <Send aria-hidden />
            {fr.validation.send}
          </Button>
        </div>
        {error}
      </form>
    );
  }
  return (
    <div className="grid gap-1.5">
      <fieldset aria-label={fr.validation.group} className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs"
          disabled={busy}
          onClick={() => void send({ kind: "option", option: VALIDATE })}
        >
          <Check aria-hidden />
          {VALIDATE}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs"
          disabled={busy}
          onClick={() => setCorrecting(true)}
        >
          <Pencil aria-hidden />
          {VALIDATION_OPTIONS[1]}
        </Button>
      </fieldset>
      {error}
    </div>
  );
}
