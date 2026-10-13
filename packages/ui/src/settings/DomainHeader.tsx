import { DOMAIN_COLORS, type Domain } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Input } from "@kibo/sdk/ui/input";
import { LayoutGrid, Pencil, Trash2 } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { frDomains } from "../i18n/fr-domains";

type Props = {
  domain: Domain;
  usage: number;
  projects: number;
  scope: { name: string; color: string } | null;
  readOnly: boolean;
  onRename(name: string): Promise<boolean>;
  onColor(color: string): Promise<boolean>;
  onDelete(): void;
};

function Swatch({ domain, readOnly, onColor }: Pick<Props, "domain" | "readOnly" | "onColor">) {
  const look = "size-5 shrink-0 rounded-[4px]";
  if (readOnly) return <span aria-hidden className={look} style={{ background: domain.color }} />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={frDomains.pickColor(domain.name)}
          className={`${look} ring-offset-background focus-visible:ring-2 focus-visible:ring-ring`}
          style={{ background: domain.color }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="grid grid-cols-4 gap-1 p-2">
        {DOMAIN_COLORS.map((color) => (
          <DropdownMenuItem
            key={color}
            aria-label={frDomains.colorOption(color)}
            className="size-7 justify-center p-0"
            onSelect={() => void onColor(color)}
          >
            <span aria-hidden className="size-4 rounded-[3px]" style={{ background: color }} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Scope({ scope }: Pick<Props, "scope">) {
  return (
    <span className="flex items-center gap-1 rounded-full border px-1.5 text-3xs text-foreground">
      {scope ? (
        <span aria-hidden className="size-1.5 rounded-full" style={{ background: scope.color }} />
      ) : (
        <LayoutGrid aria-hidden className="size-2.5" />
      )}
      {scope ? frDomains.scopeOf(scope.name) : frDomains.scopeWorkspace}
    </span>
  );
}

export function DomainHeader({
  domain,
  usage,
  projects,
  scope,
  readOnly,
  onRename,
  onColor,
  onDelete,
}: Props) {
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
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Swatch domain={domain} readOnly={readOnly} onColor={onColor} />
      <div className="grid min-w-0 gap-0.5">
        {draft === null ? (
          <span className="flex items-center gap-1">
            <h2 className="truncate text-md font-semibold">{frDomains.domainTitle(domain.name)}</h2>
            {!readOnly && (
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                aria-label={frDomains.rename(domain.name)}
                onClick={() => setDraft(domain.name)}
              >
                <Pencil className="size-3.5" />
              </Button>
            )}
          </span>
        ) : (
          <span className="grid gap-0.5">
            <Input
              aria-label={frDomains.renameField}
              value={draft}
              autoFocus
              className="h-7 w-56"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <span className="text-3xs text-muted-foreground">{frDomains.renameHint}</span>
          </span>
        )}
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Scope scope={scope} />
          <span>·</span>
          <span>{frDomains.usedIn(usage, projects)}</span>
          {readOnly && <span className="rounded border px-1 text-3xs">{frDomains.readOnly}</span>}
        </span>
      </div>
      <span className="flex-1" />
      {!readOnly && (
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label={frDomains.deleteDomain(domain.name)}
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
