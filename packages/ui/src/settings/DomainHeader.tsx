import { DOMAIN_COLORS, type Domain } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Input } from "@kibo/sdk/ui/input";
import { Pencil, Trash2 } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { fr } from "../i18n/fr";

type Props = {
  domain: Domain;
  usage: number;
  onRename(name: string): Promise<boolean>;
  onColor(color: string): Promise<boolean>;
  onDelete(): void;
};

export function DomainHeader({ domain, usage, onRename, onColor, onDelete }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = async () => {
    if (draft === null) return;
    if (await onRename(draft.trim())) setDraft(null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void save();
    if (e.key === "Escape") setDraft(null);
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={fr.domains.pickColor(domain.name)}
            className="size-3 rounded-[3px] ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            style={{ background: domain.color }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="grid grid-cols-4 gap-1 p-2">
          {DOMAIN_COLORS.map((color) => (
            <DropdownMenuItem
              key={color}
              aria-label={fr.domains.colorOption(color)}
              className="size-7 justify-center p-0"
              onSelect={() => void onColor(color)}
            >
              <span aria-hidden className="size-4 rounded-[3px]" style={{ background: color }} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {draft === null ? (
        <>
          <h2 className="text-md font-semibold">{fr.domains.domainTitle(domain.name)}</h2>
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            aria-label={fr.domains.rename(domain.name)}
            onClick={() => setDraft(domain.name)}
          >
            <Pencil className="size-3.5" />
          </Button>
        </>
      ) : (
        <span className="grid gap-0.5">
          <Input
            aria-label={fr.domains.renameField}
            value={draft}
            autoFocus
            className="h-7 w-56"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <span className="text-3xs text-muted-foreground">{fr.domains.renameHint}</span>
        </span>
      )}
      <span className="text-xs text-muted-foreground">{fr.domains.usedBy(usage)}</span>
      <span className="flex-1" />
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label={fr.domains.deleteDomain(domain.name)}
        onClick={onDelete}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </>
  );
}
