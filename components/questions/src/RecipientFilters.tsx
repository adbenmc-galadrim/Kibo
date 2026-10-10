import { KiboError, type QuestionRecipient } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { Plus } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { fr } from "./fr";
import type { RecipientCounts } from "./questions-logic";

const ALL = "*";

type Props = {
  recipients: readonly QuestionRecipient[];
  counts: RecipientCounts;
  value: string | null;
  readOnly: boolean;
  onChange(recipient: string | null): void;
  children?: ReactNode;
};

function Pill({ value, name, count }: { value: string; name: string; count: number }) {
  return (
    <ToggleGroupItem
      value={value}
      aria-label={fr.recipients.filter(name, count)}
      className="h-7 gap-1.5 rounded-full border px-3 text-xs font-normal first:rounded-full last:rounded-full data-[state=on]:border-foreground"
    >
      {name}
      <span className="text-muted-foreground">{count}</span>
    </ToggleGroupItem>
  );
}

function AddRecipient() {
  const sdk = useSdk();
  const [name, setName] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  if (name === null)
    return (
      <Button variant="ghost" size="sm" className="h-7 text-xs font-normal" onClick={() => setName("")}>
        <Plus aria-hidden />
        {fr.recipients.add}
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

export function RecipientFilters({ recipients, counts, value, readOnly, onChange, children }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
      <ToggleGroup
        type="single"
        size="sm"
        aria-label={fr.recipients.label}
        className="flex-wrap gap-1.5"
        value={value ?? ALL}
        onValueChange={(v) => {
          if (v !== "") onChange(v === ALL ? null : v);
        }}
      >
        <Pill value={ALL} name={fr.recipients.all} count={counts.total} />
        {recipients.map((r) => (
          <Pill key={r.id} value={r.id} name={r.name} count={counts.byRecipient.get(r.id) ?? 0} />
        ))}
      </ToggleGroup>
      {!readOnly && <AddRecipient />}
      <span className="flex-1" />
      {children}
    </div>
  );
}
