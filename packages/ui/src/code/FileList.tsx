import type { ChangeArea, ChangeKind, FileChange } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { fr } from "../i18n/fr";

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
  onSelect(file: FileChange): void;
  onToggle(file: FileChange): void;
};

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

type RowProps = { file: FileChange; active: boolean; busy: boolean } & Pick<Props, "onSelect" | "onToggle">;

function Row({ file, active, busy, onSelect, onToggle }: RowProps) {
  const { name, dir } = splitPath(file.path);
  const staged = file.area === "staged";
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60",
        active && "bg-accent",
      )}
    >
      <Checkbox
        checked={staged}
        disabled={busy || file.kind === "conflicted"}
        aria-label={staged ? fr.changes.unstageFile(file.path) : fr.changes.stageFile(file.path)}
        onCheckedChange={() => onToggle(file)}
      />
      <button
        type="button"
        aria-current={active || undefined}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => onSelect(file)}
      >
        <span
          aria-hidden
          className={cn("w-3 shrink-0 font-mono text-2xs font-semibold", KIND_TONE[file.kind])}
        >
          {fr.changes.kind[file.kind]}
        </span>
        <span className="sr-only">{fr.changes.kindLabel[file.kind]}</span>
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
    </li>
  );
}

type SectionProps = { area: ChangeArea; title: string; files: FileChange[] } & Omit<Props, "files">;

function Section({ area, title, files, selected, busy, onSelect, onToggle }: SectionProps) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return (
    <fieldset aria-labelledby={id} className="m-0 min-w-0 border-0 p-0">
      <button
        type="button"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-1 px-2 py-2 text-2xs font-medium uppercase tracking-wide",
          MUTED,
        )}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
        <span id={id}>{title}</span>
        <span className="ml-auto">{files.length}</span>
      </button>
      {open && (
        <ul className="grid gap-0.5">
          {files.map((f) => (
            <Row
              key={`${area}:${f.path}`}
              file={f}
              active={selected?.path === f.path && selected.area === area}
              busy={busy}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </fieldset>
  );
}

export function FileList({ files, ...rest }: Props) {
  const staged = files.filter((f) => f.area === "staged");
  const unstaged = files.filter((f) => f.area === "unstaged");
  return (
    <div className="grid gap-2">
      <Section area="staged" title={fr.changes.staged} files={staged} {...rest} />
      <Section area="unstaged" title={fr.changes.unstaged} files={unstaged} {...rest} />
    </div>
  );
}
