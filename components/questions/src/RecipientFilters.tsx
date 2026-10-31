import { KiboError, type QuestionRecipient } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Input } from "@kibo/sdk/ui/input";
import { ChevronDown, Plus, UserRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import { fr } from "./fr";
import { FILTER_MENU } from "./QuestionsToolbar";
import { CLIENT_RECIPIENT, type RecipientCounts, recipientName } from "./questions-logic";

const ALL = "*";

type Props = {
  recipients: readonly QuestionRecipient[];
  client: string | null;
  counts: RecipientCounts;
  value: string | null;
  onChange(recipient: string | null): void;
};

function AddRecipient({ onClose }: { onClose(): void }) {
  const sdk = useSdk();
  const [name, setName] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed === "") return onClose();
    setFailure(null);
    try {
      await sdk.run({ method: "addQuestionRecipient", name: trimmed });
      onClose();
    } catch (err) {
      if (err instanceof KiboError && err.code === "QUOTA_EXCEEDED") return setFailure(fr.recipients.quota);
      console.error(err);
      setFailure(fr.recipients.addFailed);
    }
  };
  return (
    <form className="flex items-center gap-2" onSubmit={submit}>
      <Input
        aria-label={fr.recipients.addLabel}
        placeholder={fr.recipients.addLabel}
        className="h-7 w-44 text-xs"
        maxLength={40}
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      />
      {failure !== null && (
        <span role="alert" className="text-xs text-destructive">
          {failure}
        </span>
      )}
    </form>
  );
}

export function RecipientFilters({ recipients, client, counts, value, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const count = (id: string) => counts.byRecipient.get(id) ?? 0;
  const shown = recipients
    .filter((r) => r.id === value || count(r.id) > 0)
    .sort((a, b) => Number(b.id === CLIENT_RECIPIENT) - Number(a.id === CLIENT_RECIPIENT));
  const label =
    value === null ? fr.recipients.shownAll : fr.recipients.shown(recipientName(recipients, value, client));
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={FILTER_MENU}>
            <UserRound aria-hidden className="size-3.25" />
            {label}
            <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-56"
          onCloseAutoFocus={(e) => adding && e.preventDefault()}
        >
          <DropdownMenuRadioGroup value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
            <DropdownMenuRadioItem value={ALL} className="text-xs">
              {fr.recipients.filter(fr.recipients.all, counts.total)}
            </DropdownMenuRadioItem>
            {shown.map((r) => (
              <DropdownMenuRadioItem key={r.id} value={r.id} className="text-xs">
                {fr.recipients.filter(recipientName(recipients, r.id, client), count(r.id))}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-xs" onSelect={() => setAdding(true)}>
            <Plus aria-hidden />
            {fr.recipients.addLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {adding && <AddRecipient onClose={() => setAdding(false)} />}
    </div>
  );
}
