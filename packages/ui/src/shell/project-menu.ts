import type { MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Pencil, Plus, Share2, Trash2 } from "lucide-react";

export type ProjectMenuActions = { newPage(): void; share(): void; edit(): void; remove(): void };
export type ProjectMenuTexts = { newPage: string; share: string; edit: string; remove: string };

export function projectMenuEntries(input: {
  editable: boolean;
  texts: ProjectMenuTexts;
  actions: ProjectMenuActions;
}): MenuEntry[] {
  const { editable, texts, actions } = input;
  const share: MenuEntry = { label: texts.share, icon: Share2, onSelect: actions.share };
  const remove: MenuEntry = {
    label: texts.remove,
    icon: Trash2,
    destructive: true,
    onSelect: actions.remove,
  };
  if (!editable) return [share, { separator: true }, remove];
  return [
    { label: texts.newPage, icon: Plus, onSelect: actions.newPage },
    share,
    { label: texts.edit, icon: Pencil, onSelect: actions.edit },
    { separator: true },
    remove,
  ];
}
