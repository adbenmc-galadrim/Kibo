import { frShortcuts } from "../i18n/fr-shortcuts";
import { shortcutLabel } from "../lib/shortcut-label";

export type ShortcutItem = { label: string; keys: string[]; range?: boolean };
export type ShortcutGroup = { title: string; items: ShortcutItem[] };

const t = frShortcuts.items;

export function shortcutGroups(mac: boolean): ShortcutGroup[] {
  const mod = (...keys: string[]) => shortcutLabel(keys, mac);
  return [
    {
      title: frShortcuts.navigation,
      items: [
        { label: t.palette, keys: [mod("K")] },
        { label: t.newTab, keys: [mod("T")] },
        { label: t.closeTab, keys: [mod("W")] },
        { label: t.reopenTab, keys: [mod("Shift", "T")] },
        { label: t.togglePin, keys: [mod("Shift", "P")] },
        { label: t.home, keys: [mod("1")] },
        { label: t.goToTab, keys: [mod("2"), mod("8")], range: true },
        { label: t.lastTab, keys: [mod("9")] },
      ],
    },
    {
      title: frShortcuts.palette,
      items: [
        { label: t.openSelection, keys: ["↵"] },
        { label: t.openInSheet, keys: [mod("↵")] },
        { label: t.nextFilter, keys: ["Tab"] },
      ],
    },
    {
      title: frShortcuts.code,
      items: [
        { label: t.save, keys: [mod("S")] },
        { label: t.externalEditor, keys: [mod("Shift", "O")] },
        { label: t.commit, keys: [mod("↵")] },
      ],
    },
  ];
}
