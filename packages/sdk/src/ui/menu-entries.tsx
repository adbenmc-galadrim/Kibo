import type { LucideIcon } from "lucide-react";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@kibo/sdk/ui/context-menu";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@kibo/sdk/ui/dropdown-menu";

export type MenuAction = {
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect(): void;
};
export type MenuSubmenu = { label: string; icon?: LucideIcon; items: MenuAction[] };
export type MenuSeparator = { separator: true };
export type MenuEntry = MenuAction | MenuSubmenu | MenuSeparator;

export const isSeparator = (e: MenuEntry): e is MenuSeparator => "separator" in e;
export const isSubmenu = (e: MenuEntry): e is MenuSubmenu => "items" in e;

type Parts = {
  Item: typeof ContextMenuItem | typeof DropdownMenuItem;
  Separator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator;
  Shortcut: typeof ContextMenuShortcut | typeof DropdownMenuShortcut;
  Sub: typeof ContextMenuSub | typeof DropdownMenuSub;
  SubTrigger: typeof ContextMenuSubTrigger | typeof DropdownMenuSubTrigger;
  SubContent: typeof ContextMenuSubContent | typeof DropdownMenuSubContent;
};

const CONTEXT: Parts = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Shortcut: ContextMenuShortcut,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
};
const DROPDOWN: Parts = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Shortcut: DropdownMenuShortcut,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};

function Action({ action, parts }: { action: MenuAction; parts: Parts }) {
  const Icon = action.icon;
  return (
    <parts.Item
      disabled={action.disabled}
      variant={action.destructive ? "destructive" : "default"}
      onSelect={action.onSelect}
    >
      {Icon && <Icon aria-hidden />}
      {action.label}
      {action.shortcut && <parts.Shortcut>{action.shortcut}</parts.Shortcut>}
    </parts.Item>
  );
}

function Entries({ entries, parts }: { entries: readonly MenuEntry[]; parts: Parts }) {
  return (
    <>
      {entries.map((entry, i) => {
        if (isSeparator(entry)) return <parts.Separator key={i} />;
        if (isSubmenu(entry)) {
          const Icon = entry.icon;
          return (
            <parts.Sub key={i}>
              <parts.SubTrigger>
                {Icon && <Icon aria-hidden />}
                {entry.label}
              </parts.SubTrigger>
              <parts.SubContent>
                {entry.items.map((item, j) => (
                  <Action key={j} action={item} parts={parts} />
                ))}
              </parts.SubContent>
            </parts.Sub>
          );
        }
        return <Action key={i} action={entry} parts={parts} />;
      })}
    </>
  );
}

export function ContextMenuEntries({ entries }: { entries: readonly MenuEntry[] }) {
  return <Entries entries={entries} parts={CONTEXT} />;
}

export function DropdownMenuEntries({ entries }: { entries: readonly MenuEntry[] }) {
  return <Entries entries={entries} parts={DROPDOWN} />;
}
