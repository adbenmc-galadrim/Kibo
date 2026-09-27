import type { Page } from "@kibo/schema";
import type { MenuAction, MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { ArrowDown, ArrowUp, ExternalLink, FolderInput, Pencil, Plus, Trash2 } from "lucide-react";

export type PageMenuTexts = {
  openNewTab: string;
  newSubPage: string;
  rename: string;
  moveUp: string;
  moveDown: string;
  moveTo: string;
  root: string;
  remove: string;
};
export type PageMenuActions = {
  openNewTab(): void;
  newSubPage(): void;
  rename(): void;
  moveUp(): void;
  moveDown(): void;
  moveTo(parentId: string | null): void;
  remove(): void;
};

export function descendantIds(pages: readonly Page[], id: string): Set<string> {
  const out = new Set<string>();
  const visit = (parentId: string) => {
    for (const p of pages) {
      if (p.parentId === parentId && !out.has(p.id)) {
        out.add(p.id);
        visit(p.id);
      }
    }
  };
  visit(id);
  return out;
}

export function moveTargets(pages: readonly Page[], page: Page): Page[] {
  const excluded = descendantIds(pages, page.id);
  return pages.filter((p) => p.id !== page.id && !excluded.has(p.id));
}

export function siblingIndex(pages: readonly Page[], page: Page): { index: number; count: number } {
  const siblings = pages.filter((p) => p.parentId === page.parentId);
  return { index: siblings.findIndex((p) => p.id === page.id), count: siblings.length };
}

export function pageMenuEntries(input: {
  page: Page;
  pages: readonly Page[];
  editable: boolean;
  texts: PageMenuTexts;
  actions: PageMenuActions;
}): MenuEntry[] {
  const { page, pages, editable, texts, actions } = input;
  const open: MenuAction = { label: texts.openNewTab, icon: ExternalLink, onSelect: actions.openNewTab };
  if (!editable) return [open];
  const { index, count } = siblingIndex(pages, page);
  const targets: MenuAction[] = [
    { label: texts.root, disabled: page.parentId === null, onSelect: () => actions.moveTo(null) },
    ...moveTargets(pages, page).map(
      (p): MenuAction => ({
        label: p.title,
        disabled: p.id === page.parentId,
        onSelect: () => actions.moveTo(p.id),
      }),
    ),
  ];
  return [
    open,
    { label: texts.newSubPage, icon: Plus, onSelect: actions.newSubPage },
    { label: texts.rename, icon: Pencil, onSelect: actions.rename },
    { label: texts.moveUp, icon: ArrowUp, disabled: index <= 0, onSelect: actions.moveUp },
    { label: texts.moveDown, icon: ArrowDown, disabled: index >= count - 1, onSelect: actions.moveDown },
    { label: texts.moveTo, icon: FolderInput, items: targets },
    { separator: true },
    { label: texts.remove, icon: Trash2, destructive: true, onSelect: actions.remove },
  ];
}
