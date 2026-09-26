import type { NoteMeta, NotesInfo } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Plus, Search } from "lucide-react";
import { noteDate } from "./dates";
import { fr } from "./fr";

type Props = {
  notes: NoteMeta[];
  info: NotesInfo | null;
  selected: string | null;
  query: string;
  onQuery(q: string): void;
  onSelect(path: string): void;
  onCreate(): void;
};

function FolderLine({ info }: { info: NotesInfo }) {
  return (
    <p className="truncate px-1 font-mono text-[11px] text-muted-foreground">
      <span>{info.displayDir}</span>
      {info.obsidian && (
        <>
          {" · "}
          <span>{fr.obsidian}</span>
        </>
      )}
    </p>
  );
}

export function NoteList({ notes, info, selected, query, onQuery, onSelect, onCreate }: Props) {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-3 border-r p-3">
      <div className="relative">
        <Search aria-hidden className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={fr.search}
          aria-label={fr.search}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>
      {info && <FolderLine info={info} />}
      {notes.length === 0 && (
        <p className="px-1 text-sm text-muted-foreground">{query ? fr.noResult : fr.emptyList}</p>
      )}
      <ul aria-label="Notes" className="grid flex-1 content-start gap-1 overflow-auto">
        {notes.map((n) => (
          <li key={n.path}>
            <button
              type="button"
              onClick={() => onSelect(n.path)}
              aria-current={selected === n.path ? "true" : undefined}
              className={cn(
                "grid w-full gap-0.5 rounded-md px-2 py-2 text-left hover:bg-accent",
                selected === n.path && "bg-accent",
              )}
            >
              <span className="truncate text-sm font-medium">{n.title}</span>
              <span className="text-xs text-muted-foreground">
                {noteDate(n.mtime)}
                {n.tickets.length > 0 && ` · ${fr.links(n.tickets.length)}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" className="w-fit" onClick={onCreate}>
        <Plus aria-hidden />
        {fr.newNote}
      </Button>
    </aside>
  );
}
