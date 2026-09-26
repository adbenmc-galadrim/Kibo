import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Plus } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { fr } from "../i18n/fr";

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
        className="flex items-center gap-2 px-2 py-1.5 text-left text-sm text-muted-foreground hover:text-foreground"
      >
        <Plus aria-hidden className="size-4" />
        {fr.domains.newDomain}
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="grid gap-2 px-2 pt-1">
      <label htmlFor={id} className="sr-only">
        {fr.domains.domainName}
      </label>
      <Input
        id={id}
        value={name}
        placeholder={fr.domains.domainName}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <Button type="submit" size="sm" disabled={!name.trim()}>
        {fr.domains.create}
      </Button>
    </form>
  );
}
