import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { Instance, Page, ProjectSnapshot, TabTarget } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@kibo/sdk/ui/context-menu";
import { ContextMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { type MouseEvent, type ReactNode, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { type Flash, useFlash } from "../lib/use-flash";
import { pageIcon } from "../registry";
import { canEdit } from "../state/access";
import { NavCount } from "./nav/NavRow";
import { PageRowMenu } from "./nav/PageRowMenu";
import { pageBadge } from "./nav/page-badges";
import { activePageOf } from "./nav/planning-missing";
import { pageDropPlan, parseZoneId, zoneId } from "./page-drop";
import { pageMenuEntries, siblingIndex } from "./page-menu";

type Props = {
  project: ProjectSnapshot;
  activeTarget: TabTarget | null;
  header: ReactNode;
  onOpen(target: TabTarget, newTab: boolean, keep?: boolean): void;
  onNewPage(parentId: string | null): void;
  onRenamePage(page: Page): void;
  onDeletePage(page: Page): void;
};

const wantsNewTab = (e: MouseEvent) => e.metaKey || e.ctrlKey;

function RootDrop({ children, editable }: { children: ReactNode; editable: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: zoneId({ kind: "root" }), disabled: !editable });
  return (
    <div ref={setNodeRef} className={cn("rounded-md", isOver && "ring-2 ring-ring")}>
      {children}
    </div>
  );
}

type RowProps = {
  page: Page;
  projectId: string;
  instance: Instance | null;
  flash: Flash["flash"];
  entries: MenuEntry[];
  editable: boolean;
  active: boolean;
  onClick(e: MouseEvent): void;
  onAuxClick(e: MouseEvent): void;
  onDoubleClick(e: MouseEvent): void;
  children: ReactNode;
  icon: ReactNode;
  depth: number;
  badge: string | null;
};

const ZONE_PLACES = {
  before: "top-0 h-1/4",
  inside: "top-1/4 h-1/2",
  after: "bottom-0 h-1/4",
} as const;

type ZoneKind = keyof typeof ZONE_PLACES;

function ZoneLayer({ kind, setNodeRef }: { kind: ZoneKind; setNodeRef(node: HTMLElement | null): void }) {
  return (
    <div
      ref={setNodeRef}
      data-drop-zone={kind}
      aria-hidden
      className={cn("pointer-events-none absolute inset-x-0", ZONE_PLACES[kind])}
    />
  );
}

function DropLine({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded bg-ring", className)}
    />
  );
}

const PAGE_INDENT = 26;
const DEPTH_INDENT = 18;

function PageRow({
  page,
  projectId,
  instance,
  flash,
  entries,
  editable,
  active,
  children,
  icon,
  depth,
  badge,
  ...handlers
}: RowProps) {
  const before = useDroppable({ id: zoneId({ kind: "before", pageId: page.id }), disabled: !editable });
  const inside = useDroppable({ id: zoneId({ kind: "inside", pageId: page.id }), disabled: !editable });
  const after = useDroppable({ id: zoneId({ kind: "after", pageId: page.id }), disabled: !editable });
  const drag = useDraggable({ id: page.id, disabled: !editable });
  return (
    <li className="group/menu-item relative">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className={cn("k-page-row relative rounded-md", inside.isOver && "ring-2 ring-ring")}>
            {editable && (
              <>
                <ZoneLayer kind="before" setNodeRef={before.setNodeRef} />
                <ZoneLayer kind="inside" setNodeRef={inside.setNodeRef} />
                <ZoneLayer kind="after" setNodeRef={after.setNodeRef} />
              </>
            )}
            {before.isOver && <DropLine className="-top-px" />}
            {after.isOver && <DropLine className="-bottom-px" />}
            <button
              type="button"
              ref={drag.setNodeRef}
              {...drag.attributes}
              {...drag.listeners}
              data-active={active || undefined}
              aria-current={active ? "page" : undefined}
              className="k-row"
              style={{ paddingLeft: PAGE_INDENT + depth * DEPTH_INDENT }}
              onClick={handlers.onClick}
              onAuxClick={handlers.onAuxClick}
              onDoubleClick={handlers.onDoubleClick}
              aria-describedby={undefined}
            >
              {icon}
              <span>{page.title}</span>
              {badge && <NavCount yields={editable}>{badge}</NavCount>}
            </button>
            {editable && (
              <PageRowMenu
                title={page.title}
                projectId={projectId}
                instance={instance}
                entries={entries}
                flash={flash}
              />
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuEntries entries={entries} />
        </ContextMenuContent>
      </ContextMenu>
      {children}
    </li>
  );
}

export function ProjectPages(p: Props) {
  const { project, activeTarget, onOpen } = p;
  const projectId = project.meta.id;
  const editable = canEdit(project);
  const [error, setError] = useState<string | null>(null);
  const notice = useFlash();
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
    const zone = e.over ? parseZoneId(String(e.over.id)) : null;
    const plan = zone ? pageDropPlan(project.pages, String(e.active.id), zone) : null;
    if (plan) void move(plan.pageId, plan.parentId, plan.index);
  };
  const activePageId = activePageOf(project, activeTarget);
  const children = (parentId: string | null) => project.pages.filter((x) => x.parentId === parentId);
  const renderPages = (parentId: string | null, depth: number): ReactNode =>
    children(parentId).map((page) => {
      const Icon = pageIcon(page, project.instances);
      const target: TabTarget = { kind: "page", projectId, pageId: page.id };
      const active = activePageId === page.id;
      return (
        <PageRow
          key={page.id}
          page={page}
          projectId={projectId}
          instance={
            page.kind === "view" ? (project.instances.find((i) => i.pageId === page.id) ?? null) : null
          }
          flash={notice.flash}
          entries={entriesFor(page)}
          editable={editable}
          active={active}
          onClick={(e) => onOpen(target, wantsNewTab(e))}
          onAuxClick={(e) => {
            if (e.button !== 1) return;
            e.preventDefault();
            onOpen(target, true);
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            onOpen(target, false, true);
          }}
          icon={<Icon size={15} absoluteStrokeWidth />}
          depth={depth}
          badge={pageBadge(page.id, project)}
        >
          {children(page.id).length > 0 && <ul className="k-list">{renderPages(page.id, depth + 1)}</ul>}
        </PageRow>
      );
    });
  const hasSub = children(null).length > 0;
  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
      <RootDrop editable={editable}>{p.header}</RootDrop>
      {hasSub && <ul className="k-list mt-[2px]">{renderPages(null, 0)}</ul>}
      {error && (
        <p role="alert" className="px-2 py-1 text-xs text-destructive">
          {error}
        </p>
      )}
      {notice.message && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "px-2 py-1 text-xs",
            notice.tone === "error" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {notice.message}
        </p>
      )}
    </DndContext>
  );
}
