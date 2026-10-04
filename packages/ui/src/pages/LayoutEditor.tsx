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
  type SizeLimits,
} from "@kibo/schema";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frLayout } from "../i18n/fr-layout";
import { errorMessage } from "../lib/error-message";
import { compactInstances, instanceFormat } from "../lib/format-grid";
import { ConfirmDialog } from "../shell/lazy-dialogs";
import { DashboardGrid } from "./DashboardGrid";
import { EditorWidget } from "./EditorWidget";
import { GridGuides } from "./GridGuides";
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
import { useGridMetrics, useTitles } from "./layout-editor-hooks";
import { type ArrowKey, keyboardResize, type ResizeEdge, resizeTarget } from "./layout-resize";
import type { Pointer } from "./ResizeHandles";

export type LayoutEditorProps = {
  projectId: string;
  page: Page;
  instances: Instance[];
  formatsFor(instance: Instance): ComponentFormat[];
  limitsFor(instance: Instance): SizeLimits;
  renderWidget(instance: Instance, layout: Layout): ReactNode;
  onClose(): void;
};

const ARROWS: Readonly<Record<string, [number, number]>> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
};

type Sizing = { id: string; edge: ResizeEdge; start: Layout; origin: Pointer };
type Shown = { id: string; preview: Preview; held: boolean };

export function LayoutEditor({
  projectId,
  page,
  instances,
  formatsFor,
  limitsFor,
  renderWidget,
  onClose,
}: LayoutEditorProps) {
  const saved = useMemo(() => compactInstances(instances), [instances]);
  const [edits, setEdits] = useState<Draft>(() => new Map());
  const [preview, setPreview] = useState<Shown | null>(null);
  const [live, setLive] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Instance | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const metrics = useGridMetrics(wrapper);
  const ghost = preview?.held ? preview.preview.landing : null;
  const latest = useRef({
    metrics,
    ghost,
    dragging: null as string | null,
    sizing: null as Sizing | null,
    dropped: "",
  });
  latest.current.metrics = metrics;
  latest.current.ghost = ghost;
  const titleOf = useTitles(instances);
  const layouts = useMemo(() => displayedLayouts(saved, edits), [saved, edits]);
  const changes = useMemo(() => changedIds(saved, layouts), [saved, layouts]);
  const shown = !preview
    ? layouts
    : preview.held
      ? heldPreview(preview.preview.layouts, preview.id, layouts)
      : preview.preview.layouts;
  const sizingId = preview && !preview.held ? preview.id : null;

  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || latest.current.dragging !== null) return;
      if (latest.current.sizing) {
        latest.current.sizing = null;
        setPreview(null);
        return;
      }
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
    setPreview(next ? { id, preview: next, held: true } : null);
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
  const limitsOf = (id: string): SizeLimits | null => {
    const instance = instances.find((i) => i.id === id);
    return instance ? limitsFor(instance) : null;
  };
  const startResize = (id: string, edge: ResizeEdge, origin: Pointer) => {
    const start = layouts.get(id);
    if (!start || latest.current.dragging !== null) return;
    latest.current.sizing = { id, edge, start, origin };
  };
  const resize = (pointer: Pointer) => {
    const s = latest.current.sizing;
    const limits = s && limitsOf(s.id);
    if (!s || !limits) return;
    const delta = { x: pointer.x - s.origin.x, y: pointer.y - s.origin.y };
    const target = resizeTarget(s.start, s.edge, delta, metrics, limits);
    const next = previewSize(layouts, s.id, target);
    if (!next) return;
    setPreview({ id: s.id, preview: next, held: false });
    setLive(frLayout.cells(target.w, target.h));
  };
  const endResize = () => {
    if (!latest.current.sizing) return;
    latest.current.sizing = null;
    if (preview && !preview.held) setEdits(editsOf(saved, preview.preview));
    setPreview(null);
  };
  const keyResize = (id: string, key: ArrowKey) => {
    const current = layouts.get(id);
    const limits = limitsOf(id);
    if (!current || !limits || latest.current.dragging !== null || latest.current.sizing) return;
    const target = keyboardResize(current, key, limits);
    const next = previewSize(layouts, id, target);
    if (!next) return;
    setEdits(editsOf(saved, next));
    setLive(frLayout.sized(titleOf(id), target.w, target.h));
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
                  layout={layout}
                  sizing={sizingId === i.id ? layout : null}
                  current={current}
                  formats={formatsFor(i)}
                  onFormat={(f) => pickFormat(i.id, f)}
                  onRemove={() => setRemoving(i)}
                  onResizeStart={(edge, pointer) => startResize(i.id, edge, pointer)}
                  onResize={resize}
                  onResizeEnd={endResize}
                  onKeyResize={(key) => keyResize(i.id, key)}
                >
                  {renderWidget(i, layout)}
                </EditorWidget>
              );
            }}
          />
        </DndContext>
      </div>
      <output aria-live="polite" className="sr-only">
        {live}
      </output>
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
