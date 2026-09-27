import type { NoteMeta } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@kibo/sdk/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { ContextMenuEntries, DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "./fr";

export type NoteMenuActions = { rename(): void; remove(): void };

export const noteMenuEntries = (actions: NoteMenuActions): MenuEntry[] => [
  { label: fr.rename, icon: Pencil, onSelect: actions.rename },
  { label: fr.remove, icon: Trash2, destructive: true, onSelect: actions.remove },
];

type Props = { note: NoteMeta; readOnly: boolean; actions: NoteMenuActions; children: ReactNode };

export function NoteMenu({ note, readOnly, actions, children }: Props) {
  if (readOnly) return <>{children}</>;
  const entries = noteMenuEntries(actions);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group/note relative">
          {children}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-1.5 right-1.5 size-6 opacity-0 group-hover/note:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
                aria-label={fr.actions(note.title)}
              >
                <Ellipsis className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuEntries entries={entries} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuEntries entries={entries} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
