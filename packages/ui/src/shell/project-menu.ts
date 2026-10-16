import type { MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { CalendarRange, FolderOpen, Pencil, Plus, Share2, Trash2 } from "lucide-react";

export type ProjectMenuActions = {
  newPage(): void;
  planning: (() => void) | null;
  share(): void;
  edit(): void;
  files: (() => void) | null;
  remove(): void;
};
export type ProjectMenuTexts = {
  newPage: string;
  planning: string;
  share: string;
  edit: string;
  files: string;
  remove: string;
};

export function projectMenuEntries(input: {
  editable: boolean;
  texts: ProjectMenuTexts;
  actions: ProjectMenuActions;
}): MenuEntry[] {
  const { editable, texts, actions } = input;
  const share: MenuEntry = { label: texts.share, icon: Share2, onSelect: actions.share };
  const files: MenuEntry[] = actions.files
    ? [{ label: texts.files, icon: FolderOpen, onSelect: actions.files }]
    : [];
  const remove: MenuEntry = {
    label: texts.remove,
    icon: Trash2,
    destructive: true,
    onSelect: actions.remove,
  };
  if (!editable) return [share, ...files, { separator: true }, remove];
  const planning: MenuEntry[] = actions.planning
    ? [{ label: texts.planning, icon: CalendarRange, onSelect: actions.planning }]
    : [];
  return [
    { label: texts.newPage, icon: Plus, onSelect: actions.newPage },
    ...planning,
    share,
    { label: texts.edit, icon: Pencil, onSelect: actions.edit },
    ...files,
    { separator: true },
    remove,
  ];
}
