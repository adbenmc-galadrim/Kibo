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
import {
  type ComponentFormat,
  FORMAT_SIZES,
  type Instance,
  type Layout,
  type Page,
  splitRef,
} from "@kibo/schema";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frLayout } from "../i18n/fr-layout";
import { errorMessage } from "../lib/error-message";
import { type CellMetrics, cellMetrics, compactInstances, instanceFormat } from "../lib/format-grid";
import { findComponent } from "../registry";
import { ConfirmDialog } from "../shell/lazy-dialogs";
import { useComponents } from "../state/use-components";
import { DashboardGrid } from "./DashboardGrid";
import { EditorWidget } from "./EditorWidget";
import { GridGuides } from "./GridGuides";
import { instanceTitle } from "./instance-title";
import { LayoutToolbar } from "./LayoutToolbar";
import {
  changedIds,
  type Draft,
  displayedLayouts,
  editsOf,
  heldPreview,
  type Preview,
  previewMove,
  previewSize,
} from "./layout-draft";

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
  const saved = compactInstances(instances);
  const [edits, setEdits] = useState<Draft>(() => new Map());
  const [preview, setPreview] = useState<{ id: string; preview: Preview } | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Instance | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const metrics = useGridMetrics(wrapper);
  const ghost = preview?.preview.landing ?? null;
  const latest = useRef({ metrics, ghost, dragging: null as string | null, dropped: "" });
  latest.current.metrics = metrics;
  latest.current.ghost = ghost;
  const titleOf = useTitles(instances);
  const layouts = displayedLayouts(saved, edits);
  const changes = changedIds(saved, layouts);
  const shown = preview ? heldPreview(preview.preview.layouts, preview.id, layouts) : layouts;

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
      return g ? frLayout.over(titleOf(String(active.id)), g.x, g.y) : undefined;
    },
    onDragOver: () => undefined,
    onDragEnd: () => latest.current.dropped,
    onDragCancel: ({ active }) => frLayout.canceled(titleOf(String(active.id))),
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    latest.current.dragging = String(active.id);
  };
  const onDragMove = ({ active, delta }: DragMoveEvent) => {
    const id = String(active.id);
    const next = previewMove(layouts, id, delta, metrics);
    latest.current.ghost = next?.landing ?? null;
    setPreview(next ? { id, preview: next } : null);
  };
  const onDragEnd = ({ active, delta }: DragEndEvent) => {
    const id = String(active.id);
    const next = previewMove(layouts, id, delta, metrics);
    if (next) {
      latest.current.dropped = frLayout.dropped(titleOf(id), next.landing.x, next.landing.y);
      setEdits(editsOf(saved, next));
    }
    stopDrag();
  };
  const stopDrag = () => {
    const ended = latest.current.dragging;
    // dnd-kit cancels a pointer drag on the document keydown, before the window Escape listener runs
    window.setTimeout(() => {
      if (latest.current.dragging === ended) latest.current.dragging = null;
    }, 0);
    latest.current.ghost = null;
    setPreview(null);
  };
  const pickFormat = (id: string, format: ComponentFormat) => {
    const next = previewSize(layouts, id, FORMAT_SIZES[format]);
    if (next) setEdits(editsOf(saved, next));
  };

  const save = async () => {
    if (changes.length === 0) return onClose();
    setSaving(true);
    setFailure(null);
    try {
      await client.rpc({
        method: "command",
        projectId,
        command: {
          method: "setPageLayout",
          pageId: page.id,
          layouts: changes.flatMap((id) => {
            const layout = layouts.get(id);
            return layout ? [{ instanceId: id, layout }] : [];
          }),
        },
      });
      onClose();
    } catch (error) {
      console.error(error);
      setFailure(`${frLayout.saveFailed(titleOf(changes[0] ?? ""))} ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
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
            layouts={shown}
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
