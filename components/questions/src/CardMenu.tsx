import { type Question, questionLabel } from "@kibo/schema";
import { useWriteBlock } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { blockedBy, DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Archive, Ellipsis, Pencil, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { fr } from "./fr";

type Props = {
  question: Question;
  canArchive: boolean;
  onEdit: (() => void) | null;
  onExport: (() => void) | null;
  onArchive(): void;
  onRemove(): void;
};

function entries(
  props: Props,
  runOnClose: (action: () => void) => void,
  blocked: string | null,
): MenuEntry[] {
  const { canArchive, onEdit, onExport, onArchive, onRemove } = props;
  const lock = blockedBy(blocked);
  const actions: MenuEntry[] = [];
  if (onEdit !== null) actions.push({ label: fr.edit.open, icon: Pencil, onSelect: onEdit, ...lock });
  if (canArchive) actions.push({ label: fr.archive, icon: Archive, onSelect: onArchive, ...lock });
  if (onExport !== null)
    actions.push({ label: fr.exporting.single, icon: Upload, onSelect: () => runOnClose(onExport), ...lock });
  const remove: MenuEntry = {
    label: fr.remove,
    icon: Trash2,
    destructive: true,
    onSelect: onRemove,
    ...lock,
  };
  return actions.length === 0 ? [remove] : [...actions, { separator: true }, remove];
}

export function CardMenu(props: Props) {
  const onClosed = useRef<(() => void) | null>(null);
  const blocked = useWriteBlock();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-5 text-muted-foreground @max-lg:size-11 @max-lg:rounded-lg @max-lg:border"
          aria-label={fr.menu(questionLabel(props.question))}
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-55"
        onCloseAutoFocus={(e) => {
          if (onClosed.current === null) return;
          e.preventDefault();
          onClosed.current();
          onClosed.current = null;
        }}
      >
        <DropdownMenuEntries
          entries={entries(
            props,
            (action) => {
              onClosed.current = action;
            },
            blocked,
          )}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
