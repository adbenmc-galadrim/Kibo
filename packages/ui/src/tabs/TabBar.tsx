import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Tab, TabsState, TabTarget } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@kibo/sdk/ui/context-menu";
import { AppWindow, Copy, Pin, PinOff, Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "../i18n/fr";
import { WorkspaceTile } from "../shell/WorkspaceMark";
import type { TabDescription } from "./tab-title";
import type { TabsAction } from "./tabs-model";

type Props = {
  state: TabsState;
  describe(target: TabTarget): TabDescription;
  isDirty(target: TabTarget): boolean;
  dispatch(action: TabsAction): void;
  onNewTab(): void;
  onOpenWindow: ((target: TabTarget) => void) | null;
  error: string | null;
  trailing?: ReactNode;
};

type ItemProps = {
  tab: Tab;
  active: boolean;
  description: TabDescription;
  dirty: boolean;
  dispatch(action: TabsAction): void;
  onOpenWindow: ((target: TabTarget) => void) | null;
};

const tabTone = (active: boolean) =>
  active
    ? "bg-background text-foreground"
    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

function TabMenu({ tab, dispatch, onOpenWindow }: Pick<ItemProps, "tab" | "dispatch" | "onOpenWindow">) {
  return (
    <ContextMenuContent className="w-72">
      <ContextMenuItem onSelect={() => dispatch({ type: "pin", id: tab.id, pinned: !tab.pinned })}>
        {tab.pinned ? <PinOff /> : <Pin />}
        {tab.pinned ? fr.tabs.unpin : fr.tabs.pin}
        <ContextMenuShortcut>⌘⇧P</ContextMenuShortcut>
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
        <ContextMenuShortcut>⌘W</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => dispatch({ type: "closeOthers", id: tab.id })}>
        <X />
        {fr.tabs.closeOthers}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => dispatch({ type: "closeRight", id: tab.id })}>
        <X />
        {fr.tabs.closeRight}
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

function TabItem({ tab, active, description, dirty, dispatch, onOpenWindow }: ItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tab.id });
  const Icon = description.icon;
  const close = () => dispatch({ type: "close", id: tab.id });
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={{ transform: CSS.Transform.toString(transform), transition }}
          className={cn("group flex shrink-0 items-center text-xs", tabTone(active))}
          onAuxClick={(e) => {
            if (e.button !== 1 || tab.pinned) return;
            e.preventDefault();
            close();
          }}
        >
          <button
            type="button"
            {...attributes}
            {...listeners}
            role="tab"
            aria-selected={active}
            aria-label={description.title}
            title={description.title}
            className={cn(
              "flex h-full items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              tab.pinned ? "px-3" : "pl-3 pr-1.5",
            )}
            onClick={() => dispatch({ type: "activate", id: tab.id })}
          >
            {tab.pinned && (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full bg-muted-foreground"
                style={description.color ? { background: description.color } : undefined}
              />
            )}
            <Icon aria-hidden className="size-4 shrink-0" />
            {!tab.pinned && (
              <span
                className={cn(
                  "max-w-48 truncate",
                  tab.target.kind === "file" && "font-mono",
                  description.missing && "italic",
                )}
              >
                {description.title}
              </span>
            )}
            {!tab.pinned && dirty && (
              <span
                role="img"
                aria-label={fr.tabs.dirty}
                className="size-1.5 shrink-0 rounded-full bg-amber-500"
              />
            )}
          </button>
          {!tab.pinned && (
            <button
              type="button"
              aria-label={fr.tabs.close(description.title)}
              className="mr-2 rounded-sm p-0.5 opacity-70 hover:bg-accent hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={close}
            >
              <X aria-hidden className="size-3.5" />
            </button>
          )}
        </div>
      </ContextMenuTrigger>
      <TabMenu tab={tab} dispatch={dispatch} onOpenWindow={onOpenWindow} />
    </ContextMenu>
  );
}

export function TabBar({
  state,
  describe,
  isDirty,
  dispatch,
  onNewTab,
  onOpenWindow,
  error,
  trailing,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const pinned = state.tabs.filter((t) => t.pinned);
  const open = state.tabs.filter((t) => !t.pinned);
  const onDragEnd = (e: DragEndEvent) => {
    const overId = e.over?.id;
    if (overId === undefined || overId === e.active.id) return;
    dispatch({
      type: "move",
      id: String(e.active.id),
      toIndex: state.tabs.findIndex((t) => t.id === overId),
    });
  };
  const item = (tab: Tab) => (
    <TabItem
      key={tab.id}
      tab={tab}
      active={state.activeId === tab.id}
      description={describe(tab.target)}
      dirty={isDirty(tab.target)}
      dispatch={dispatch}
      onOpenWindow={onOpenWindow}
    />
  );
  return (
    <div className="flex h-10 shrink-0 items-stretch border-b bg-sidebar text-sidebar-foreground">
      <div
        role="tablist"
        aria-label={fr.tabs.bar}
        className="flex min-w-0 flex-1 items-stretch overflow-x-auto"
      >
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex shrink-0 items-stretch border-r">
            <button
              type="button"
              role="tab"
              aria-selected={state.activeId === null}
              aria-label={fr.tabs.home}
              title={fr.tabs.home}
              className={cn(
                "flex w-11 shrink-0 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                tabTone(state.activeId === null),
              )}
              onClick={() => dispatch({ type: "activate", id: null })}
            >
              <WorkspaceTile size="sm" />
            </button>
            <SortableContext items={pinned.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
              {pinned.map(item)}
            </SortableContext>
          </div>
          <SortableContext items={open.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
            {open.map(item)}
          </SortableContext>
        </DndContext>
        <Button
          variant="ghost"
          size="icon"
          className="mx-1 size-8 shrink-0 self-center text-muted-foreground"
          aria-label={fr.tabs.newTab}
          onClick={onNewTab}
        >
          <Plus />
        </Button>
      </div>
      {trailing && <div className="flex shrink-0 items-center px-3 empty:hidden">{trailing}</div>}
      {error && (
        <p role="alert" className="flex shrink-0 items-center px-3 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
