import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Plus } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { frDomains } from "../i18n/fr-domains";

export function NewDomainForm({ onCreate }: { onCreate: (name: string) => Promise<boolean> }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (await onCreate(trimmed)) {
      setName("");
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-2 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus aria-hidden className="size-4" />
        {frDomains.newDomain}
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="grid gap-2 px-2 pt-1">
      <label htmlFor={id} className="sr-only">
        {frDomains.domainName}
      </label>
      <Input
        id={id}
        value={name}
        placeholder={frDomains.domainName}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <Button type="submit" size="sm" disabled={!name.trim()}>
        {frDomains.create}
      </Button>
    </form>
  );
}
