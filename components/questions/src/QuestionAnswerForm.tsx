import type { Question } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Check } from "lucide-react";
import { type FormEvent, useState } from "react";
import { fr } from "./fr";
import { type AnswerForm, answerFrom } from "./questions-logic";
import { useAnswer } from "./use-questions";

export const AGENT_ACCENT =
  "border-orange-500/40 text-orange-600 hover:bg-orange-500/10 dark:text-orange-400";

type Props = { question: Question };

export function QuestionAnswerForm({ question }: Props) {
  const answer = useAnswer();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const send = async (form: AnswerForm) => {
    const input = answerFrom(form);
    if (input === null) return;
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
    void send({ option: null, text, confirm: false });
  };
  return (
    <form aria-label={fr.answerTo(question.title)} className="grid gap-2" onSubmit={submit}>
      {(question.options.length > 0 || question.provisional !== null) && (
        <div className="flex flex-wrap gap-1.5">
          {question.provisional !== null && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`h-7 text-xs ${AGENT_ACCENT}`}
              disabled={busy}
              onClick={() => void send({ option: null, text: "", confirm: true })}
            >
              <Check aria-hidden />
              {fr.confirm}
            </Button>
          )}
          {question.options.map((option) => (
            <Button
              key={option}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs font-normal"
              disabled={busy}
              onClick={() => void send({ option, text: "", confirm: false })}
            >
              {option}
            </Button>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <Input
          aria-label={fr.other}
          placeholder={fr.other}
          className="h-7 text-xs"
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={busy || text.trim() === ""}>
          {fr.reply}
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
