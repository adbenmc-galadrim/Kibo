import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { Page, ProjectSnapshot, TabTarget } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@kibo/sdk/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { ContextMenuEntries, DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import {
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@kibo/sdk/ui/sidebar";
import { Ellipsis } from "lucide-react";
import { type MouseEvent, type ReactNode, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { pageIcon } from "../registry";
import { canEdit } from "../state/access";
import { pageMenuEntries, siblingIndex } from "./page-menu";

const ROOT = "root";

type Props = {
  project: ProjectSnapshot;
  activeTarget: TabTarget | null;
  header: ReactNode;
  trailing: ReactNode;
  onOpen(target: TabTarget, newTab: boolean): void;
  onNewPage(parentId: string | null): void;
  onRenamePage(page: Page): void;
  onDeletePage(page: Page): void;
};

const wantsNewTab = (e: MouseEvent) => e.metaKey || e.ctrlKey;

function RootDrop({ children, editable }: { children: ReactNode; editable: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT, disabled: !editable });
  return (
    <div ref={setNodeRef} className={cn("rounded-md", isOver && "ring-2 ring-ring")}>
      {children}
    </div>
  );
}

type RowProps = {
  page: Page;
  entries: MenuEntry[];
  editable: boolean;
  active: boolean;
  onClick(e: MouseEvent): void;
  onAuxClick(e: MouseEvent): void;
  children: ReactNode;
  icon: ReactNode;
};

function PageRow({ page, entries, editable, active, onClick, onAuxClick, children, icon }: RowProps) {
  const drop = useDroppable({ id: page.id, disabled: !editable });
  const drag = useDraggable({ id: page.id, disabled: !editable });
  return (
    <SidebarMenuSubItem
      ref={drop.setNodeRef}
      className={cn("group/page", drop.isOver && "rounded-md ring-2 ring-ring")}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="relative">
            <SidebarMenuSubButton asChild isActive={active}>
              <button
                type="button"
                ref={drag.setNodeRef}
                {...drag.attributes}
                {...drag.listeners}
                onClick={onClick}
                onAuxClick={onAuxClick}
                aria-describedby={undefined}
              >
                {icon}
                <span>{page.title}</span>
              </button>
            </SidebarMenuSubButton>
            {editable && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction
                    showOnHover
                    aria-label={fr.nav.pageActions(page.title)}
                    className="top-1 right-1 size-5"
                  >
                    <Ellipsis />
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="right">
                  <DropdownMenuEntries entries={entries} />
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuEntries entries={entries} />
        </ContextMenuContent>
      </ContextMenu>
      {children}
    </SidebarMenuSubItem>
  );
}

export function ProjectPages(p: Props) {
  const { project, activeTarget, onOpen } = p;
  const projectId = project.meta.id;
  const editable = canEdit(project);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const move = async (pageId: string, parentId: string | null, index?: number) => {
    setError(null);
    try {
      await client.rpc({
        method: "command",
        projectId,
        command: { method: "movePage", pageId, parentId, ...(index === undefined ? {} : { index }) },
      });
    } catch {
      setError(fr.nav.moveFailed);
    }
  };
  const entriesFor = (page: Page): MenuEntry[] => {
    const { index } = siblingIndex(project.pages, page);
    return pageMenuEntries({
      page,
      pages: project.pages,
      editable,
      texts: fr.nav,
      actions: {
        openNewTab: () => onOpen({ kind: "page", projectId, pageId: page.id }, true),
        newSubPage: () => p.onNewPage(page.id),
        rename: () => p.onRenamePage(page),
        moveUp: () => void move(page.id, page.parentId, index - 1),
        moveDown: () => void move(page.id, page.parentId, index + 1),
        moveTo: (parentId) => void move(page.id, parentId),
        remove: () => p.onDeletePage(page),
      },
    });
  };
  const onDragEnd = (e: DragEndEvent) => {
    const overId = e.over?.id;
    if (overId === undefined || overId === e.active.id) return;
    const page = project.pages.find((x) => x.id === e.active.id);
    const parentId = overId === ROOT ? null : String(overId);
    if (!page || page.parentId === parentId) return;
    void move(page.id, parentId);
  };
  const children = (parentId: string | null) => project.pages.filter((x) => x.parentId === parentId);
  const renderPages = (parentId: string | null): ReactNode =>
    children(parentId).map((page) => {
      const Icon = pageIcon(page, project.instances);
      const target: TabTarget = { kind: "page", projectId, pageId: page.id };
      return (
        <PageRow
          key={page.id}
          page={page}
          entries={entriesFor(page)}
          editable={editable}
          active={
            activeTarget?.kind === "page" &&
            activeTarget.projectId === projectId &&
            activeTarget.pageId === page.id
          }
          onClick={(e) => onOpen(target, wantsNewTab(e))}
          onAuxClick={(e) => {
            if (e.button !== 1) return;
            e.preventDefault();
            onOpen(target, true);
          }}
          icon={<Icon />}
        >
          {children(page.id).length > 0 && <SidebarMenuSub>{renderPages(page.id)}</SidebarMenuSub>}
        </PageRow>
      );
    });
  const hasSub = children(null).length > 0 || p.trailing !== null;
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <RootDrop editable={editable}>{p.header}</RootDrop>
      {hasSub && (
        <SidebarMenuSub>
          {renderPages(null)}
          {p.trailing}
        </SidebarMenuSub>
      )}
      {error && (
        <p role="alert" className="px-2 py-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </DndContext>
  );
}
