import type { GithubRepo } from "@kibo/schema";
import { Input } from "@kibo/sdk/ui/input";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { useEffect, useId, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";

type Props = {
  labelledBy: string;
  value: string | null;
  onChange(r: GithubRepo): void;
  onError(message: string): void;
};
const t = fr.integrations.source;

function RepoRow({ name }: { name: string }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent has-[[data-state=checked]]:bg-accent"
    >
      <RadioGroupItem id={id} value={name} aria-label={name} />
      <span className="font-mono">{name}</span>
    </label>
  );
}

export function RepoList({ labelledBy, value, onChange, onError }: Props) {
  const [query, setQuery] = useState("");
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  useEffect(() => {
    let live = true;
    client
      .rpc({ method: "listGithubRepos", query })
      .then((r) => {
        if (live) setRepos(r);
      })
      .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [query, onError]);
  const needle = query.trim().toLowerCase();
  const shown = repos.filter((r) => r.fullName.toLowerCase().includes(needle));
  return (
    <div className="grid gap-2">
      <Input
        placeholder={t.repoSearch}
        aria-label={t.repoSearch}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <RadioGroup
        aria-labelledby={labelledBy}
        value={value ?? ""}
        onValueChange={(v) => {
          const r = repos.find((x) => x.fullName === v);
          if (r) onChange(r);
        }}
        className="grid max-h-40 gap-1 overflow-y-auto rounded-md border bg-background p-1"
      >
        {shown.length === 0 && <p className="p-2 text-sm text-muted-foreground">{t.repoEmpty}</p>}
        {shown.map((r) => (
          <RepoRow key={r.fullName} name={r.fullName} />
        ))}
      </RadioGroup>
    </div>
  );
}
