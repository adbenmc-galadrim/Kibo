import { KiboError, type QuestionRecipient } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { fr } from "./fr";
import { type RecipientCounts, recipientName } from "./questions-logic";

const ALL = "*";

type Props = {
  recipients: readonly QuestionRecipient[];
  client: string | null;
  counts: RecipientCounts;
  value: string | null;
  readOnly: boolean;
  onChange(recipient: string | null): void;
};

function Pill({ value, name, count }: { value: string; name: string; count: number }) {
  return (
    <ToggleGroupItem
      value={value}
      aria-label={fr.recipients.filter(name, count)}
      className="h-5.75 gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium text-muted-foreground first:rounded-md last:rounded-md data-[state=on]:border-muted-foreground data-[state=on]:text-foreground"
    >
      {name}
      <span className="font-mono text-[11px] font-normal text-muted-foreground">{count}</span>
    </ToggleGroupItem>
  );
}

function AddRecipient() {
  const sdk = useSdk();
  const [name, setName] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  if (name === null)
    return (
      <Button
        variant="ghost"
        size="sm"
        aria-label={fr.recipients.add}
        title={fr.recipients.addLabel}
        className="size-6.5 p-0 text-muted-foreground"
        onClick={() => setName("")}
      >
        <Plus aria-hidden />
      </Button>
    );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed === "") return setName(null);
    setFailure(null);
    try {
      await sdk.run({ method: "addQuestionRecipient", name: trimmed });
      setName(null);
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
        onKeyDown={(e) => e.key === "Escape" && setName(null)}
      />
      {failure !== null && (
        <span role="alert" className="text-xs text-destructive">
          {failure}
        </span>
      )}
    </form>
  );
}

export function RecipientFilters({ recipients, client, counts, value, readOnly, onChange }: Props) {
  const count = (id: string) => counts.byRecipient.get(id) ?? 0;
  const shown = recipients.filter((r) => r.id === value || count(r.id) > 0);
  return (
    <div className="flex items-center gap-1">
      <ToggleGroup
        type="single"
        size="sm"
        aria-label={fr.recipients.label}
        className="flex-wrap gap-1"
        value={value ?? ALL}
        onValueChange={(v) => {
          if (v !== "") onChange(v === ALL ? null : v);
        }}
      >
        <Pill value={ALL} name={fr.recipients.all} count={counts.total} />
        {shown.map((r) => (
          <Pill key={r.id} value={r.id} name={recipientName(recipients, r.id, client)} count={count(r.id)} />
        ))}
      </ToggleGroup>
      {!readOnly && <AddRecipient />}
    </div>
  );
}
