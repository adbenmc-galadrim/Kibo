import type { NoteMeta } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { noteDate } from "./dates";
import { fr } from "./fr";
import { NoteMenu } from "./NoteMenu";
import { isUntitledPath } from "./note-name";

type Props = {
  note: NoteMeta;
  selected: boolean;
  readOnly: boolean;
  onSelect(path: string): void;
  onRename(path: string): void;
  onRemove(path: string): void;
};

export function NoteItem({ note: n, selected, readOnly, onSelect, onRename, onRemove }: Props) {
  return (
    <li>
      <NoteMenu
        note={n}
        readOnly={readOnly}
        actions={{ rename: () => onRename(n.path), remove: () => onRemove(n.path) }}
      >
        <button
          type="button"
          onClick={() => onSelect(n.path)}
          aria-current={selected ? "true" : undefined}
          className={cn(
            "grid w-full gap-0.5 rounded-md px-2 py-2 text-left hover:bg-accent",
            selected && "bg-accent",
            !readOnly && "pr-8",
          )}
        >
          <span className="truncate text-sm font-medium">{n.title}</span>
          <span className="text-xs text-muted-foreground">
            {noteDate(n.mtime)}
            {n.tickets.length > 0 && ` · ${fr.links(n.tickets.length)}`}
          </span>
        </button>
        {isUntitledPath(n.path) &&
          (readOnly ? (
            <span className="block px-2 pb-1.5 text-xs text-muted-foreground">{fr.untitledFile}</span>
          ) : (
            <button
              type="button"
              className="block px-2 pb-1.5 text-left text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              onClick={() => onRename(n.path)}
            >
              {fr.untitledHint}
            </button>
          ))}
      </NoteMenu>
    </li>
  );
}
