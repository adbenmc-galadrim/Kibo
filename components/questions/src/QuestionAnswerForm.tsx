import type { AnswerInput, Question, QuestionAnswer } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Check } from "lucide-react";
import { type FormEvent, useState } from "react";
import { fr } from "./fr";
import { type AnswerForm, answerFrom } from "./questions-logic";
import { useAnswer } from "./use-questions";

type Props = {
  question: Question;
  initial?: QuestionAnswer;
  onSubmit?(input: AnswerInput): Promise<void>;
  onCancel?(): void;
};

const EMPTY: AnswerForm = { option: null, text: "", confirm: false };

const formOf = (a: QuestionAnswer | undefined): AnswerForm => {
  if (a === undefined) return EMPTY;
  if (a.kind === "confirm") return { ...EMPTY, confirm: true };
  if (a.kind === "option") return { ...EMPTY, option: a.option };
  return { ...EMPTY, text: a.text };
};

export function QuestionAnswerForm({ question, initial, onSubmit, onCancel }: Props) {
  const answer = useAnswer();
  const editing = initial !== undefined;
  const [choice, setChoice] = useState<AnswerForm>(() => formOf(initial));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const send = async (form: AnswerForm) => {
    const input = answerFrom(form);
    if (input === null) return;
    setBusy(true);
    setFailed(false);
    try {
      await (onSubmit ? onSubmit(input) : answer(question, input));
    } catch (e) {
      console.error(e);
      setFailed(true);
      setBusy(false);
    }
  };
  const pick = (form: AnswerForm) => (editing ? setChoice(form) : void send(form));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(editing ? choice : { ...EMPTY, text: choice.text });
  };
  const pressed = (on: boolean) => (editing ? on : undefined);
  const ready = editing ? answerFrom(choice) !== null : choice.text.trim() !== "";
  const choices = question.options.length > 0 || question.provisional !== null;
  const freeLabel = choices ? fr.other : fr.yourAnswer;
  return (
    <form
      aria-label={editing ? fr.answerEditTo(question.title) : fr.answerTo(question.title)}
      className="grid gap-2"
      onSubmit={submit}
    >
      {choices && (
        <div className="flex flex-wrap gap-1.5">
          {question.provisional !== null && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={pressed(choice.confirm)}
              className="h-7 text-xs aria-pressed:border-foreground aria-pressed:bg-accent"
              disabled={busy}
              onClick={() => pick({ ...EMPTY, confirm: true })}
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
              aria-pressed={pressed(!choice.confirm && choice.option === option)}
              className="h-7 text-xs font-normal aria-pressed:border-foreground aria-pressed:bg-accent"
              disabled={busy}
              onClick={() => pick({ ...EMPTY, option })}
            >
              {option}
            </Button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          aria-label={freeLabel}
          placeholder={freeLabel}
          className="h-9 text-[13px] md:text-[13px]"
          value={choice.text}
          disabled={busy}
          onChange={(e) => setChoice({ ...EMPTY, text: e.target.value })}
        />
        {editing && (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
            {fr.cancel}
          </Button>
        )}
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          className="h-6.25 px-2.5 text-xs disabled:opacity-100"
          disabled={busy || !ready}
        >
          {editing ? fr.save : fr.reply}
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
