import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { type ComponentFormat, type Instance, type Layout, type Page, splitRef } from "@kibo/schema";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frLayout } from "../i18n/fr-layout";
import { errorMessage } from "../lib/error-message";
import { type CellMetrics, cellMetrics, instanceFormat, resolveOverlaps } from "../lib/format-grid";
import { findComponent } from "../registry";
import { ConfirmDialog } from "../shell/lazy-dialogs";
import { useComponents } from "../state/use-components";
import { DashboardGrid } from "./DashboardGrid";
import { EditorWidget } from "./EditorWidget";
import { GridGuides } from "./GridGuides";
import { instanceTitle } from "./instance-title";
import { LayoutToolbar } from "./LayoutToolbar";
import { changedIds, type Draft, formatChoice, moveWidget, type Target, targetOf } from "./layout-draft";

export type LayoutEditorProps = {
  projectId: string;
  page: Page;
  instances: Instance[];
  formatsFor(instance: Instance): ComponentFormat[];
  renderWidget(instance: Instance, layout: Layout): ReactNode;
  onClose(): void;
};

const ARROWS: Readonly<Record<string, [number, number]>> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
};

function useGridMetrics(ref: React.RefObject<HTMLDivElement | null>): CellMetrics {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(0, el.clientWidth - 32));
    measure();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return cellMetrics(width);
}

function useTitles(instances: readonly Instance[]): (id: string) => string {
  const { components } = useComponents();
  return (id) => {
    const instance = instances.find((i) => i.id === id);
    if (!instance) return id;
    const ref = instance.component;
    const base =
      findComponent(ref)?.manifest.title ?? components?.find((c) => c.id === splitRef(ref).id)?.title ?? ref;
    return instanceTitle(instance, base);
  };
}

export function LayoutEditor({
  projectId,
  page,
  instances,
  formatsFor,
  renderWidget,
  onClose,
}: LayoutEditorProps) {
  const [origin, setOrigin] = useState<Draft>(() => resolveOverlaps(instances));
  const [draft, setDraft] = useState<Draft>(origin);
  const [ghost, setGhost] = useState<Target | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Instance | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const metrics = useGridMetrics(wrapper);
  const latest = useRef({ metrics, ghost, dragging: null as string | null, dropped: "" });
  latest.current.metrics = metrics;
  latest.current.ghost = ghost;
  const titleOf = useTitles(instances);
  const layouts: Draft = new Map(
    instances.map((i) => [i.id, draft.get(i.id) ?? origin.get(i.id) ?? i.layout]),
  );
  const changes = changedIds(origin, layouts);

  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || latest.current.dragging !== null) return;
      close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const steps: KeyboardCoordinateGetter = (event, { currentCoordinates }) => {
    const arrow = ARROWS[event.code];
    if (!arrow) return undefined;
    event.preventDefault();
    const m = latest.current.metrics;
    return {
      x: currentCoordinates.x + arrow[0] * (m.column + m.gap),
      y: currentCoordinates.y + arrow[1] * (m.row + m.gap),
    };
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: steps }),
  );
  const announcements: Announcements = {
    onDragStart: ({ active }) => frLayout.picked(titleOf(String(active.id))),
    onDragMove: ({ active }) => {
      const g = latest.current.ghost;
      return g ? frLayout.over(titleOf(String(active.id)), g.layout.x, g.layout.y, g.free) : undefined;
    },
    onDragOver: () => undefined,
    onDragEnd: () => latest.current.dropped,
    onDragCancel: ({ active }) => frLayout.canceled(titleOf(String(active.id))),
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    latest.current.dragging = String(active.id);
  };
  const onDragMove = ({ active, delta }: DragMoveEvent) => {
    const target = targetOf(layouts, String(active.id), delta, metrics);
    latest.current.ghost = target;
    setGhost(target);
  };
  const onDragEnd = ({ active, delta }: DragEndEvent) => {
    const id = String(active.id);
    const moved = moveWidget(layouts, id, delta, metrics);
    const placed = moved.layouts.get(id);
    latest.current.dropped =
      moved.placed && placed
        ? frLayout.dropped(titleOf(id), placed.x, placed.y)
        : frLayout.refused(titleOf(id));
    if (moved.placed) setDraft(moved.layouts);
    stopDrag();
  };
  const stopDrag = () => {
    const ended = latest.current.dragging;
    // dnd-kit cancels a pointer drag on the document keydown, before the window Escape listener runs
    window.setTimeout(() => {
      if (latest.current.dragging === ended) latest.current.dragging = null;
    }, 0);
    latest.current.ghost = null;
    setGhost(null);
  };
  const pickFormat = (id: string, format: ComponentFormat) => {
    const choice = formatChoice(layouts, id, format);
    if (choice?.free) setDraft(new Map(layouts).set(id, choice.layout));
  };

  const save = async () => {
    setSaving(true);
    setFailure(null);
    const done = new Map(origin);
    let pending = changes;
    let refusal: { id: string; error: unknown } | null = null;
    while (pending.length > 0) {
      const refused: string[] = [];
      refusal = null;
      for (const id of pending) {
        const layout = layouts.get(id);
        if (!layout) continue;
        try {
          await client.rpc({
            method: "command",
            projectId,
            command: { method: "setInstanceLayout", instanceId: id, layout },
          });
          done.set(id, layout);
        } catch (error) {
          refused.push(id);
          refusal ??= { id, error };
        }
      }
      if (refused.length === pending.length) break;
      pending = refused;
    }
    setOrigin(done);
    setSaving(false);
    if (!refusal) return onClose();
    console.error(refusal.error);
    setFailure(`${frLayout.saveFailed(titleOf(refusal.id))} ${errorMessage(refusal.error)}`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LayoutToolbar
        changes={changes.length}
        saving={saving}
        failure={failure}
        onCancel={onClose}
        onSave={() => void save()}
      />
      <div ref={wrapper} className="flex min-h-0 flex-1 flex-col">
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={stopDrag}
          accessibility={{ announcements, screenReaderInstructions: { draggable: frLayout.instructions } }}
        >
          <DashboardGrid
            instances={instances}
            layouts={layouts}
            narrow={false}
            overlay={<GridGuides metrics={metrics} ghost={ghost} />}
            renderWidget={(i, layout) => {
              const title = titleOf(i.id);
              const current = instanceFormat({ ...i, layout }, page);
              return (
                <EditorWidget
                  instance={i}
                  title={title}
                  current={current}
                  formats={formatsFor(i)}
                  fits={(f) => formatChoice(layouts, i.id, f)?.free === true}
                  onFormat={(f) => pickFormat(i.id, f)}
                  onRemove={() => setRemoving(i)}
                >
                  {renderWidget(i, layout)}
                </EditorWidget>
              );
            }}
          />
        </DndContext>
      </div>
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRemoving(null)}
          title={fr.instance.removeTitle(titleOf(removing.id))}
          description={fr.instance.removeHelp}
          confirmLabel={fr.instance.removeConfirm}
          cancelLabel={fr.common.cancel}
          onConfirm={async () => {
            await client.rpc({
              method: "command",
              projectId,
              command: { method: "removeInstance", instanceId: removing.id },
            });
          }}
          describeError={errorMessage}
        />
      )}
    </div>
  );
}
