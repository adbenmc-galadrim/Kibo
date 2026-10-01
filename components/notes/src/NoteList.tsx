import type { NotesInfo } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { Input } from "@kibo/sdk/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { ChevronRight, Folder, Plus, Search } from "lucide-react";
import { fr } from "./fr";
import { NoteItem } from "./NoteItem";
import { NOTE_SORTS, type NoteGroup, type NoteSort } from "./note-sort";

type Props = {
  groups: NoteGroup[];
  info: NotesInfo | null;
  selected: string | null;
  query: string;
  sort: NoteSort;
  onQuery(q: string): void;
  onSort(sort: NoteSort): void;
  onSelect(path: string): void;
  onCreate(): void;
  readOnly: boolean;
  onRename(path: string): void;
  onRemove(path: string): void;
};

function FolderLine({ info }: { info: NotesInfo }) {
  return (
    <p className="truncate px-1 font-mono text-2xs text-muted-foreground">
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

function SortSelect({ sort, onSort }: { sort: NoteSort; onSort(sort: NoteSort): void }) {
  return (
    <Select
      value={sort}
      onValueChange={(v) => {
        const next = NOTE_SORTS.find((s) => s === v);
        if (next) onSort(next);
      }}
    >
      <SelectTrigger size="sm" aria-label={fr.sortLabel} className="h-7 w-full text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {NOTE_SORTS.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {fr.sorts[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function NoteList(p: Props) {
  const { groups, info, selected, query, sort, onQuery, onSort, onCreate, readOnly } = p;
  const item = (n: NoteGroup["notes"][number]) => (
    <NoteItem
      key={n.path}
      note={n}
      selected={selected === n.path}
      readOnly={readOnly}
      onSelect={p.onSelect}
      onRename={p.onRename}
      onRemove={p.onRemove}
    />
  );
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
      <SortSelect sort={sort} onSort={onSort} />
      {info && <FolderLine info={info} />}
      {groups.length === 0 && (
        <p className="px-1 text-sm text-muted-foreground">{query ? fr.noResult : fr.emptyList}</p>
      )}
      <ul aria-label="Notes" className="grid flex-1 content-start gap-1 overflow-auto">
        {groups.map((g) =>
          g.dir === "" ? (
            g.notes.map(item)
          ) : (
            <li key={`dir:${g.dir}`}>
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="group flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left text-xs font-medium text-muted-foreground hover:text-foreground">
                  <ChevronRight
                    aria-hidden
                    className="size-3.5 transition-transform group-data-[state=open]:rotate-90"
                  />
                  <Folder aria-hidden className="size-3.5" />
                  <span className="truncate">{g.dir}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="grid gap-1 pl-3">{g.notes.map(item)}</ul>
                </CollapsibleContent>
              </Collapsible>
            </li>
          ),
        )}
      </ul>
      {!readOnly && (
        <Button variant="outline" size="sm" className="w-fit" onClick={onCreate}>
          <Plus aria-hidden />
          {fr.newNote}
        </Button>
      )}
    </aside>
  );
}
