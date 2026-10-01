import type { MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { FolderInput, Maximize2, Trash2 } from "lucide-react";
import type { frInbox } from "../i18n/fr-inbox";

export type InboxMenuInput = {
  texts: typeof frInbox;
  actions: { open(): void; file(): void; remove(): void };
};

export function inboxMenuEntries({ texts, actions }: InboxMenuInput): MenuEntry[] {
  return [
    { label: texts.open, icon: Maximize2, onSelect: actions.open },
    { label: texts.fileTo, icon: FolderInput, onSelect: actions.file },
    { separator: true },
    { label: texts.remove, icon: Trash2, destructive: true, onSelect: actions.remove },
  ];
}
