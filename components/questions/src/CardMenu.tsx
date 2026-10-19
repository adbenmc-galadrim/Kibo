import { type Question, questionLabel } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Archive, Ellipsis, Trash2 } from "lucide-react";
import { fr } from "./fr";

type Props = { question: Question; canArchive: boolean; onArchive(): void; onRemove(): void };

function entries({ canArchive, onArchive, onRemove }: Props): MenuEntry[] {
  const remove: MenuEntry = { label: fr.remove, icon: Trash2, destructive: true, onSelect: onRemove };
  if (!canArchive) return [remove];
  return [{ label: fr.archive, icon: Archive, onSelect: onArchive }, { separator: true }, remove];
}

export function CardMenu(props: Props) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-5 text-muted-foreground"
          aria-label={fr.menu(questionLabel(props.question))}
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuEntries entries={entries(props)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
