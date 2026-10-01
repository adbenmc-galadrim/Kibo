import type { ChangeArea, ChangeKind, FileChange } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@kibo/sdk/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { ContextMenuEntries, DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { ChevronDown, Ellipsis } from "lucide-react";
import { useId, useState } from "react";
import { fr } from "../i18n/fr";
import { fileMenuEntries } from "./file-menu";

export type FileSelection = { path: string; area: ChangeArea };

export const pickSelected = (files: FileChange[], selection: FileSelection | null): FileChange | null =>
  files.find((f) => f.path === selection?.path && f.area === selection.area) ??
  files.find((f) => f.area === "staged") ??
  files[0] ??
  null;

type Props = {
  files: FileChange[];
  selected: FileSelection | null;
  busy: boolean;
  readOnly: boolean;
  onSelect(file: FileChange): void;
  onToggle(file: FileChange): void;
  onOpenInTab(file: FileChange): void;
  onOpenExternal(file: FileChange): void;
  onCopyPath(file: FileChange): void;
  onDiscard(file: FileChange): void;
  onStageAll(): void;
  onUnstageAll(): void;
};
type FileHandlers = Pick<
  Props,
  "onSelect" | "onToggle" | "onOpenInTab" | "onOpenExternal" | "onCopyPath" | "onDiscard"
>;

const ADDED = "text-green-800 dark:text-green-400";
const REMOVED = "text-red-700 dark:text-red-400";
const MUTED = "text-zinc-600 dark:text-zinc-400";
const KIND_TONE: Record<ChangeKind, string> = {
  modified: "text-amber-700 dark:text-amber-400",
  added: ADDED,
  untracked: ADDED,
  deleted: REMOVED,
  renamed: "text-sky-700 dark:text-sky-400",
  conflicted: REMOVED,
};

const splitPath = (path: string) => {
  const slash = path.lastIndexOf("/");
  return { name: path.slice(slash + 1), dir: slash >= 0 ? path.slice(0, slash + 1) : "" };
};

type RowProps = { file: FileChange; active: boolean; busy: boolean; readOnly: boolean } & FileHandlers;

const rowEntries = ({ file, readOnly, ...h }: RowProps): MenuEntry[] =>
  fileMenuEntries({
    file,
    readOnly,
    texts: fr.changes,
    actions: {
      viewDiff: () => h.onSelect(file),
      openInTab: () => h.onOpenInTab(file),
      openExternal: () => h.onOpenExternal(file),
      copyPath: () => h.onCopyPath(file),
      toggleStage: () => h.onToggle(file),
      discard: () => h.onDiscard(file),
    },
  });

function RowActions({ path, entries }: { path: string; entries: MenuEntry[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-6 shrink-0"
          aria-label={fr.changes.fileActions(path)}
        >
          <Ellipsis aria-hidden className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuEntries entries={entries} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Row(props: RowProps) {
  const { file, active, busy, readOnly, onSelect, onToggle } = props;
  const { name, dir } = splitPath(file.path);
  const staged = file.area === "staged";
  const entries = rowEntries(props);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <li
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60",
            active && "bg-accent",
          )}
        >
          {readOnly ? (
            <span aria-hidden className="size-4 shrink-0" />
          ) : (
            <Checkbox
              checked={staged}
              disabled={busy || file.kind === "conflicted"}
              aria-label={staged ? fr.changes.unstageFile(file.path) : fr.changes.stageFile(file.path)}
              onCheckedChange={() => onToggle(file)}
            />
          )}
          <button
            type="button"
            aria-current={active || undefined}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            onClick={() => onSelect(file)}
          >
            <span className={cn("w-14 shrink-0 text-2xs font-medium", KIND_TONE[file.kind])}>
              {fr.changes.kind[file.kind]}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate font-mono text-xs", file.kind === "deleted" && MUTED)}>
                {name}
              </span>
              <span className={cn("block truncate font-mono text-3xs", MUTED)}>{dir}</span>
            </span>
            <span className="flex shrink-0 gap-1.5 font-mono text-3xs">
              {Boolean(file.additions) && <span className={ADDED}>+{file.additions}</span>}
              {Boolean(file.deletions) && <span className={REMOVED}>−{file.deletions}</span>}
            </span>
          </button>
          <RowActions path={file.path} entries={entries} />
        </li>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuEntries entries={entries} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

type Bulk = { label: string; onClick(): void };
type SectionProps = {
  area: ChangeArea;
  title: string;
  files: FileChange[];
  bulk: Bulk;
  selected: FileSelection | null;
  busy: boolean;
  readOnly: boolean;
} & FileHandlers;

function Section({ area, title, files, bulk, selected, busy, readOnly, ...handlers }: SectionProps) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return (
    <fieldset aria-labelledby={id} className="m-0 min-w-0 border-0 p-0">
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          aria-expanded={open}
          className={cn("flex min-w-0 flex-1 items-center gap-1 px-2 py-2 text-xs font-medium", MUTED)}
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
          <span id={id} className="truncate">
            {fr.changes.section(title, files.length)}
          </span>
        </button>
        {!readOnly && files.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-2xs"
            disabled={busy}
            onClick={bulk.onClick}
          >
            {bulk.label}
          </Button>
        )}
      </div>
      {open && (
        <ul className="grid gap-0.5">
          {files.map((f) => (
            <Row
              key={`${area}:${f.path}`}
              file={f}
              active={selected?.path === f.path && selected.area === area}
              busy={busy}
              readOnly={readOnly}
              {...handlers}
            />
          ))}
        </ul>
      )}
    </fieldset>
  );
}

export function FileList({ files, onStageAll, onUnstageAll, ...rest }: Props) {
  const staged = files.filter((f) => f.area === "staged");
  const unstaged = files.filter((f) => f.area === "unstaged");
  return (
    <div className="grid gap-2">
      <Section
        area="staged"
        title={fr.changes.staged}
        files={staged}
        bulk={{ label: fr.changes.unstageAll, onClick: onUnstageAll }}
        {...rest}
      />
      <Section
        area="unstaged"
        title={fr.changes.unstaged}
        files={unstaged}
        bulk={{ label: fr.changes.stageAll, onClick: onStageAll }}
        {...rest}
      />
    </div>
  );
}
