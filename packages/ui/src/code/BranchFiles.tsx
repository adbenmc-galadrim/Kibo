import type { BranchChanges, BranchFile } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { ChevronDown, GitBranch } from "lucide-react";
import { useId, useState } from "react";
import { fr } from "../i18n/fr";
import { ADDED, KIND_TONE, MUTED, REMOVED, splitPath } from "./file-tones";

type View = {
  changes: BranchChanges | null;
  selected: BranchFile | null;
  select(file: BranchFile): void;
};

function Row({ file, active, onSelect }: { file: BranchFile; active: boolean; onSelect(): void }) {
  const { name, dir } = splitPath(file.path);
  return (
    <li className={cn("rounded-md px-2 py-1.5 hover:bg-accent/60", active && "bg-accent")}>
      <button
        type="button"
        aria-current={active || undefined}
        className="flex w-full min-w-0 items-center gap-2 text-left"
        onClick={onSelect}
      >
        <span aria-hidden className="size-4 shrink-0" />
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
    </li>
  );
}

export function BranchFiles({ view }: { view: View }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  const { changes } = view;
  if (!changes?.base || changes.files.length === 0) return null;
  const title = fr.changes.branch(changes.files.length, changes.additions, changes.deletions, changes.base);
  return (
    <section aria-labelledby={id} className="grid min-w-0 gap-0.5 border-t pt-2">
      <button
        type="button"
        aria-expanded={open}
        className={cn("flex min-w-0 items-start gap-1 px-2 py-2 text-left text-xs font-medium", MUTED)}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown
          aria-hidden
          className={cn("size-3.5 shrink-0 transition-transform", !open && "-rotate-90")}
        />
        <GitBranch aria-hidden className="size-3.5 shrink-0" />
        <span id={id} className="min-w-0 break-words">
          {title}
        </span>
      </button>
      {open && (
        <ul className="grid gap-0.5">
          {changes.files.map((f) => (
            <Row
              key={f.path}
              file={f}
              active={view.selected?.path === f.path}
              onSelect={() => view.select(f)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
