import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { type FormEvent, type KeyboardEvent, useId, useState } from "react";
import { frDomains } from "../i18n/fr-domains";

type Props = { onCreate(name: string): Promise<boolean>; onCancel(): void };

export function NewDomainForm({ onCreate, onCancel }: Props) {
  const id = useId();
  const [name, setName] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed && (await onCreate(trimmed))) setName("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") onCancel();
  };

  return (
    <form onSubmit={submit} className="flex min-w-0 flex-1 items-center gap-1">
      <label htmlFor={id} className="sr-only">
        {frDomains.domainName}
      </label>
      <Input
        id={id}
        value={name}
        placeholder={frDomains.domainName}
        className="h-6 min-w-0 flex-1 px-1.5 text-xs"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onKeyDown}
        autoFocus
      />
      <Button type="submit" size="sm" className="h-6 px-2 text-xs" disabled={!name.trim()}>
        {frDomains.create}
      </Button>
    </form>
  );
}
