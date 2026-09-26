import type { RunView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

export function ReplyBox({ run }: { run: RunView }) {
  const id = useId();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFailed(false);
    setSending(true);
    try {
      await client.rpc({ method: "answerRun", runId: run.id, text: text.trim() });
      setText("");
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-1">
      <div className="flex items-center gap-3 rounded-md border border-brand/60 px-3 py-1.5">
        <label htmlFor={id} className="sr-only">
          {fr.agents.reply.label(run.label)}
        </label>
        <Input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={fr.agents.reply.placeholder}
          className="h-8 border-0 px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <span className="shrink-0 text-xs text-muted-foreground">{fr.agents.reply.hint}</span>
        <Button
          type="submit"
          size="sm"
          disabled={!text.trim() || sending}
          className="bg-brand-strong text-white hover:bg-brand-strong/90"
        >
          {fr.agents.reply.send}
        </Button>
      </div>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {fr.agents.reply.failed}
        </p>
      )}
    </form>
  );
}
