import type { Tab, TabTarget } from "@kibo/schema";
import { ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut } from "@kibo/sdk/ui/context-menu";
import { AppWindow, Copy, Pin, PinOff, X } from "lucide-react";
import { fr } from "../i18n/fr";
import { isMac, shortcutLabel } from "../lib/shortcut-label";
import type { TabsAction } from "./tabs-model";

export type TabMenuContentProps = {
  tab: Tab;
  dispatch(action: TabsAction): void;
  onOpenWindow: ((target: TabTarget) => void) | null;
};

export function TabMenuContent({ tab, dispatch, onOpenWindow }: TabMenuContentProps) {
  const mac = isMac();
  return (
    <>
      <ContextMenuItem onSelect={() => dispatch({ type: "pin", id: tab.id, pinned: !tab.pinned })}>
        {tab.pinned ? <PinOff /> : <Pin />}
        {tab.pinned ? fr.tabs.unpin : fr.tabs.pin}
        <ContextMenuShortcut>{shortcutLabel(["Shift", "P"], mac)}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem
        onSelect={() => dispatch({ type: "duplicate", id: tab.id, newId: crypto.randomUUID() })}
      >
        <Copy />
        {fr.tabs.duplicate}
      </ContextMenuItem>
      {onOpenWindow && (
        <ContextMenuItem onSelect={() => onOpenWindow(tab.target)}>
          <AppWindow />
          {fr.tabs.newWindow}
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem disabled={tab.pinned} onSelect={() => dispatch({ type: "close", id: tab.id })}>
        <X />
        {fr.tabs.closeTab}
        <ContextMenuShortcut>{shortcutLabel(["W"], mac)}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => dispatch({ type: "closeOthers", id: tab.id })}>
        <X />
        {fr.tabs.closeOthers}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => dispatch({ type: "closeRight", id: tab.id })}>
        <X />
        {fr.tabs.closeRight}
      </ContextMenuItem>
    </>
  );
}
