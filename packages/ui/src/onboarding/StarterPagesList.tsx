import { Badge } from "@kibo/sdk/ui/badge";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Input } from "@kibo/sdk/ui/input";
import { fr } from "../i18n/fr";
import type { SelectedPage } from "./presets";

const label = (c: { id: string; config: Record<string, unknown> }, titles: Map<string, string>) =>
  c.id === "tickets" && c.config.filter === "mine" ? fr.onboarding.mineTickets : (titles.get(c.id) ?? c.id);

type Props = {
  selection: SelectedPage[];
  titles: Map<string, string>;
  onChange: (s: SelectedPage[]) => void;
};

export function StarterPagesList({ selection, titles, onChange }: Props) {
  const update = (key: string, patch: Partial<SelectedPage>) =>
    onChange(selection.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  if (selection.length === 0) return <p className="text-sm text-muted-foreground">{fr.onboarding.noPage}</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {selection.map((p, i) => (
        <li
          key={p.key}
          className={`grid grid-cols-[auto_minmax(0,11rem)_auto_minmax(0,1fr)] items-center gap-3 px-3 py-2 ${
            p.checked ? "" : "opacity-60"
          }`}
        >
          <Checkbox
            aria-label={fr.onboarding.include(p.title)}
            checked={p.checked}
            onCheckedChange={(v) => update(p.key, { checked: v === true })}
          />
          <Input
            aria-label={fr.onboarding.pageTitle(i + 1)}
            maxLength={40}
            value={p.title}
            disabled={!p.checked}
            onChange={(e) => update(p.key, { title: e.target.value })}
            className="h-8"
          />
          <Badge variant="outline">{fr.onboarding.kind[p.kind]}</Badge>
          <span className="truncate text-xs text-muted-foreground">
            {p.components.map((c) => label(c, titles)).join(" · ")}
          </span>
        </li>
      ))}
    </ul>
  );
}
