import { ME_RECIPIENT, QUESTION_OPTIONS_MAX, type QuestionRecipient, type TicketView } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { type FormEvent, useId, useState } from "react";
import { fr } from "./fr";
import { CLIENT_RECIPIENT } from "./questions-logic";

const NONE = "__none__";

type Props = {
  tickets: readonly TicketView[];
  recipients: readonly QuestionRecipient[];
  client: string | null;
  initialTicketId?: string;
  onOpenChange(open: boolean): void;
};

const optionLines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

const hasClient = (recipients: readonly QuestionRecipient[], client: string | null): boolean =>
  client !== null && recipients.some((r) => r.id === CLIENT_RECIPIENT);

const defaultRecipient = (recipients: readonly QuestionRecipient[], client: string | null): string =>
  hasClient(recipients, client) ? CLIENT_RECIPIENT : ME_RECIPIENT;

const recipientLabel = (r: QuestionRecipient, client: string | null): string =>
  r.id === CLIENT_RECIPIENT && client !== null ? fr.dialog.clientRecipient(client) : r.name;

function optionsProblem(options: readonly string[]): string | null {
  if (options.length > QUESTION_OPTIONS_MAX) return fr.dialog.tooMany;
  return new Set(options).size === options.length ? null : fr.dialog.duplicate;
}

export function NewQuestionDialog({
  tickets,
  recipients,
  client,
  initialTicketId = "",
  onOpenChange,
}: Props) {
  const sdk = useSdk();
  const id = useId();
  const [ticketId, setTicketId] = useState(initialTicketId);
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [provisional, setProvisional] = useState(NONE);
  const [picked, setPicked] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const options = optionLines(optionsText);
  const pending = tickets.filter((t) => t.statusId !== "done");
  const recipient = picked ?? defaultRecipient(recipients, client);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = optionsProblem(options);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await sdk.run({
        method: "createQuestion",
        ticketId,
        title,
        context,
        options,
        provisional: options.includes(provisional) ? provisional : null,
        blocking,
        runId: null,
        recipient,
        createdBy: { kind: "human", ref: sdk.viewer },
      });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      setError(fr.dialog.failed);
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
          <DialogHeader>
            <DialogTitle>{fr.dialog.title}</DialogTitle>
            <DialogDescription>{fr.dialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-ticket`}>{fr.dialog.ticket}</Label>
            <Select value={ticketId} onValueChange={setTicketId}>
              <SelectTrigger id={`${id}-ticket`} aria-label={fr.dialog.ticket} className="w-full">
                <SelectValue placeholder={fr.dialog.pickTicket} />
              </SelectTrigger>
              <SelectContent>
                {pending.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="font-mono text-2xs text-muted-foreground">{t.keyLabel}</span>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-title`}>{fr.dialog.questionTitle}</Label>
            <Input
              id={`${id}-title`}
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-context`}>{fr.dialog.context}</Label>
            <Textarea
              id={`${id}-context`}
              rows={3}
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-options`}>{fr.dialog.options}</Label>
            <Textarea
              id={`${id}-options`}
              rows={3}
              aria-describedby={`${id}-options-help`}
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
            />
            <p id={`${id}-options-help`} className="text-xs text-muted-foreground">
              {fr.dialog.optionsHelp}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-provisional`}>{fr.dialog.provisional}</Label>
            <Select value={options.includes(provisional) ? provisional : NONE} onValueChange={setProvisional}>
              <SelectTrigger id={`${id}-provisional`} aria-label={fr.dialog.provisional} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{fr.dialog.none}</SelectItem>
                {[...new Set(options)].slice(0, QUESTION_OPTIONS_MAX).map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-recipient`}>{fr.dialog.recipient}</Label>
            <Select value={recipient} onValueChange={setPicked}>
              <SelectTrigger id={`${id}-recipient`} aria-label={fr.dialog.recipient} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {recipients.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {recipientLabel(r, client)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${id}-blocking`}
              checked={blocking}
              onCheckedChange={(v) => setBlocking(v === true)}
            />
            <Label htmlFor={`${id}-blocking`}>{fr.dialog.blocking}</Label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {fr.dialog.cancel}
            </Button>
            <Button type="submit" disabled={busy || ticketId === "" || title.trim() === ""}>
              {fr.dialog.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
