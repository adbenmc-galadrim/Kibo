import { cn } from "@kibo/sdk/lib/utils";
import { ChevronRight } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { frDomains } from "../i18n/fr-domains";
import { type FlatItem, moveFocus } from "./folder-tree-keys";

export type TreeEntry = {
  key: string;
  label: string;
  icon: ReactNode;
  onActivate(): void;
  count?: number;
  badge?: string;
  mono?: boolean;
  muted?: boolean;
  content?: ReactNode;
  children?: TreeEntry[];
};

type Props = {
  label: string;
  entries: TreeEntry[];
  selected: string | null;
  expanded: ReadonlySet<string>;
  onToggle(key: string): void;
};

type Row = FlatItem & { entry: TreeEntry; level: number };

function flatten(
  entries: TreeEntry[],
  expanded: ReadonlySet<string>,
  parent: string | null,
  level = 1,
): Row[] {
  return entries.flatMap((entry) => {
    const open = entry.children ? expanded.has(entry.key) : null;
    const self = { key: entry.key, parent, label: entry.label, expanded: open, entry, level };
    return open && entry.children
      ? [self, ...flatten(entry.children, expanded, entry.key, level + 1)]
      : [self];
  });
}

const typing = (target: EventTarget) =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

export function FolderTree({ label, entries, selected, expanded, onToggle }: Props) {
  const rows = flatten(entries, expanded, null);
  const visible = (key: string | null) => (key && rows.some((r) => r.key === key) ? key : null);
  const [focused, setFocused] = useState<string | null>(null);
  const current = visible(focused) ?? visible(selected) ?? rows[0]?.key ?? null;
  const refs = useRef(new Map<string, HTMLDivElement>());
  const moved = useRef(false);

  useEffect(() => {
    if (!moved.current || !current) return;
    moved.current = false;
    refs.current.get(current)?.focus();
  }, [current]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, row: Row) => {
    if (typing(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      row.entry.onActivate();
      return;
    }
    const move = moveFocus(rows, row.key, e.key);
    if (!move) return;
    e.preventDefault();
    if ("focus" in move) {
      moved.current = true;
      setFocused(move.focus);
    } else onToggle("expand" in move ? move.expand : move.collapse);
  };

  return (
    <div role="tree" aria-label={label} className="grid gap-px">
      {rows.map((row) => (
        <TreeRow
          key={row.key}
          row={row}
          selected={row.key === selected}
          tabbable={row.key === current}
          setRef={(el) => {
            if (el) refs.current.set(row.key, el);
            else refs.current.delete(row.key);
          }}
          onFocus={() => setFocused(row.key)}
          onKeyDown={(e) => onKeyDown(e, row)}
          onToggle={() => onToggle(row.key)}
        />
      ))}
    </div>
  );
}

type RowProps = {
  row: Row;
  selected: boolean;
  tabbable: boolean;
  setRef(el: HTMLDivElement | null): void;
  onFocus(): void;
  onKeyDown(e: KeyboardEvent<HTMLDivElement>): void;
  onToggle(): void;
};

function TreeRow({ row, selected, tabbable, setRef, onFocus, onKeyDown, onToggle }: RowProps) {
  const countId = useId();
  const { entry, level, expanded } = row;
  return (
    <div
      ref={setRef}
      role="treeitem"
      aria-label={entry.label}
      aria-level={level}
      aria-expanded={expanded ?? undefined}
      aria-selected={selected}
      aria-describedby={entry.count === undefined ? undefined : countId}
      tabIndex={tabbable ? 0 : -1}
      onFocus={(e) => e.target === e.currentTarget && onFocus()}
      onKeyDown={onKeyDown}
      onClick={entry.onActivate}
      style={{ paddingLeft: `${level - 1}rem` }}
      className={cn(
        "flex h-7 cursor-default items-center gap-2 rounded-md pr-2 text-sm outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
        selected && "bg-accent font-medium",
        entry.muted && "text-muted-foreground",
      )}
    >
      {expanded === null ? (
        <span aria-hidden className="size-5 shrink-0" />
      ) : (
        <button
          type="button"
          tabIndex={-1}
          aria-label={expanded ? frDomains.collapse(entry.label) : frDomains.expand(entry.label)}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground"
        >
          <ChevronRight
            aria-hidden
            className={cn("size-3.5 transition-transform", expanded && "rotate-90")}
          />
        </button>
      )}
      {entry.icon}
      {entry.content ?? (
        <span className={cn("min-w-0 flex-1 truncate", entry.mono && "font-mono text-xs")}>
          {entry.label}
        </span>
      )}
      {entry.badge && (
        <span className="shrink-0 rounded border px-1 text-3xs text-muted-foreground">{entry.badge}</span>
      )}
      {entry.count !== undefined && (
        <span id={countId} className="shrink-0 font-mono text-2xs text-muted-foreground">
          {frDomains.count(entry.count)}
        </span>
      )}
    </div>
  );
}
