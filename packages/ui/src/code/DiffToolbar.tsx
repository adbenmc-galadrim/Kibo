import { Button } from "@kibo/sdk/ui/button";
import { Toggle } from "@kibo/sdk/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { ExternalLink, FileCode, Pencil } from "lucide-react";
import { fr } from "../i18n/fr";
import type { DiffMode } from "./DiffView";

type Props = {
  path: string;
  additions: number;
  deletions: number;
  mode: DiffMode;
  onModeChange(mode: DiffMode): void;
  editing: boolean;
  onEditingChange(editing: boolean): void;
  canEdit: boolean;
  onOpenFile(): void;
  onOpenExternal(): void;
};

const isDiffMode = (value: string): value is DiffMode => value === "unified" || value === "split";

export function DiffToolbar(p: Props) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
      <FileCode aria-hidden className="size-4 shrink-0 text-sky-700 dark:text-sky-400" />
      <button
        type="button"
        className="min-w-0 truncate font-mono text-sm text-sky-700 hover:underline dark:text-sky-400"
        onClick={p.onOpenFile}
      >
        {p.path}
      </button>
      <span className="flex shrink-0 gap-1.5 font-mono text-xs text-zinc-600 dark:text-zinc-400">
        <span>+{p.additions}</span>
        <span>−{p.deletions}</span>
      </span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label={fr.changes.viewMode}
        className="ml-auto shrink-0"
        value={p.mode}
        onValueChange={(v) => {
          if (isDiffMode(v)) p.onModeChange(v);
        }}
      >
        <ToggleGroupItem value="unified">{fr.changes.unified}</ToggleGroupItem>
        <ToggleGroupItem value="split">{fr.changes.split}</ToggleGroupItem>
      </ToggleGroup>
      <Toggle
        size="sm"
        variant="outline"
        pressed={p.editing}
        disabled={!p.canEdit}
        onPressedChange={p.onEditingChange}
        className="shrink-0 data-[state=on]:border-orange-500 data-[state=on]:bg-orange-500/15 data-[state=on]:text-foreground"
      >
        <Pencil aria-hidden />
        {fr.changes.edit}
      </Toggle>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0"
        aria-label={fr.changes.openExternal}
        title={fr.changes.openExternal}
        onClick={p.onOpenExternal}
      >
        <ExternalLink aria-hidden />
      </Button>
    </div>
  );
}
